import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Templates live at <dist>/../templates when published, or ../../templates from dist/init/index.js
function templatesDir(): string {
  // Try installed-package path first
  const candidates = [
    resolve(here, "..", "..", "templates"),
    resolve(here, "..", "templates"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  throw new Error(`Could not locate templates dir relative to ${here}`);
}

async function readOwnVersion(): Promise<string | null> {
  const candidates = [
    resolve(here, "..", "..", "package.json"),
    resolve(here, "..", "package.json"),
  ];
  for (const c of candidates) {
    if (!existsSync(c)) continue;
    try {
      const parsed = JSON.parse(await readFile(c, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (parsed.name === "@eval-kit/core" && typeof parsed.version === "string") {
        return parsed.version;
      }
    } catch {
      // keep looking
    }
  }
  return null;
}

export interface InitOptions {
  targetDir: string;
  projectName?: string;
  force?: boolean;
}

export async function runInit(opts: InitOptions): Promise<{
  path: string;
  created: string[];
}> {
  const { targetDir, projectName, force } = opts;
  const abs = resolve(targetDir);
  const name = projectName ?? abs.split("/").pop() ?? "my-evals";

  if (existsSync(abs) && !force) {
    // Allow init inside an existing empty dir; block otherwise unless forced
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(abs).catch(() => []);
    if (files.length > 0) {
      throw new Error(
        `Target ${abs} is not empty. Use --force to overwrite, or pick an empty directory.`,
      );
    }
  }

  await mkdir(abs, { recursive: true });
  await mkdir(join(abs, "suites"), { recursive: true });
  await mkdir(join(abs, "adapters"), { recursive: true });
  await mkdir(join(abs, "runs"), { recursive: true });

  const created: string[] = [];

  const tmpl = templatesDir();
  const suiteSrc = join(tmpl, "suite.yaml");
  const suiteDst = join(abs, "suites", "starter.yaml");
  await cp(suiteSrc, suiteDst);
  created.push(suiteDst);

  const adapterSrc = join(tmpl, "adapter.ts");
  const adapterDst = join(abs, "adapters", "my-agent.ts");
  await cp(adapterSrc, adapterDst);
  created.push(adapterDst);

  const pkgSrc = join(tmpl, "project-package.json");
  const pkgRaw = await readFile(pkgSrc, "utf8");
  const pkg = JSON.parse(pkgRaw);
  pkg.name = name;

  const ownVersion = await readOwnVersion();
  if (ownVersion && pkg.dependencies?.["@eval-kit/core"]) {
    pkg.dependencies["@eval-kit/core"] = `^${ownVersion}`;
  }

  await writeFile(join(abs, "package.json"), JSON.stringify(pkg, null, 2));
  created.push(join(abs, "package.json"));

  const readmeSrc = join(tmpl, "README.md");
  const readmeRaw = await readFile(readmeSrc, "utf8");
  await writeFile(
    join(abs, "README.md"),
    readmeRaw.replace(/^# .+$/m, `# ${name}`),
  );
  created.push(join(abs, "README.md"));

  await writeFile(
    join(abs, "runs", ".gitkeep"),
    "",
  );
  await writeFile(
    join(abs, ".gitignore"),
    ["node_modules", ".env", "runs/*.json", "!runs/.gitkeep", ""].join("\n"),
  );
  created.push(join(abs, ".gitignore"));

  return { path: abs, created };
}
