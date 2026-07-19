import { expect, test } from "vitest";
import * as core from "@eval-kit/core";
import * as ui from "@eval-kit/ui";
import * as seed from "@eval-kit/seed-suite";

// Snapshots the SORTED runtime export names of each package's built entry. A removed or
// renamed export shows up as a snapshot diff — a conscious, reviewed change, not a surprise
// for a downstream consumer. Update intentionally with `pnpm test:api -- -u`.
const names = (m: Record<string, unknown>): string[] => Object.keys(m).sort();

test("@eval-kit/core runtime exports", () => {
  expect(names(core as Record<string, unknown>)).toMatchSnapshot();
});

test("@eval-kit/ui runtime exports", () => {
  expect(names(ui as Record<string, unknown>)).toMatchSnapshot();
});

test("@eval-kit/seed-suite runtime exports", () => {
  expect(names(seed as Record<string, unknown>)).toMatchSnapshot();
});
