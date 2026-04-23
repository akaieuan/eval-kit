"use client";
import { Activity, Keyboard } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AppShell,
  CommandPalette,
  HelpMenu,
  Kbd,
  SessionTracker,
  SidebarNav,
  ThemeToggle,
  type CommandAction,
} from "@eval-kit/ui";
import { NAV_ITEMS, groupedNav } from "@/lib/nav";

const APP_VERSION = "0.2.0";

export function DashboardShell({
  children,
  breadcrumbs,
}: {
  children: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Build command palette actions from nav + commons
  const actions: CommandAction[] = [
    ...NAV_ITEMS.map<CommandAction>((item) => ({
      id: `nav-${item.id}`,
      label: `Go to ${item.label}`,
      hint: item.href,
      shortcut: item.shortcut ? item.shortcut.split(" ") : undefined,
      group: "Navigate",
      perform: ({ router, closePalette }) => {
        router.push(item.href);
        closePalette();
      },
    })),
    {
      id: "learn-quickstart",
      label: "Open quickstart",
      hint: "/docs/quickstart",
      group: "Learn",
      perform: ({ router, closePalette }) => {
        router.push("/docs/quickstart");
        closePalette();
      },
    },
    {
      id: "learn-rubric",
      label: "Open scoring rubric",
      hint: "/docs/rubric",
      group: "Learn",
      perform: ({ router, closePalette }) => {
        router.push("/docs/rubric");
        closePalette();
      },
    },
    {
      id: "learn-paradigm",
      label: "Read the paradigm essay",
      hint: "/docs/paradigm",
      group: "Learn",
      perform: ({ router, closePalette }) => {
        router.push("/docs/paradigm");
        closePalette();
      },
    },
  ];

  // Global keyboard bindings. g + letter "leader" nav, ? for shortcuts, cmd+k palette.
  useEffect(() => {
    let gLeader = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

      // cmd/ctrl + k
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing) return;

      // ?
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      // g leader
      if (!gLeader && e.key === "g") {
        gLeader = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => {
          gLeader = false;
        }, 800);
        return;
      }
      if (gLeader) {
        gLeader = false;
        if (gTimer) clearTimeout(gTimer);
        const nav = NAV_ITEMS.find(
          (n) => n.shortcut && n.shortcut.split(" ")[1] === e.key,
        );
        if (nav) {
          e.preventDefault();
          router.push(nav.href);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router]);

  const sidebarGroups = groupedNav().map((g) => ({
    label: g.label,
    items: g.items.map((i) => ({
      id: i.id,
      label: i.label,
      href: i.href,
      icon: i.icon,
      shortcut: i.shortcut,
    })),
  }));

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  return (
    <>
      <AppShell
        breadcrumbs={breadcrumbs}
        sidebar={
          <SidebarNav
            groups={sidebarGroups}
            currentPath={pathname}
            header={
              <a href="/" className="flex items-center gap-2.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-bg-elev text-fg-strong">
                  <Activity size={12} strokeWidth={1.5} />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-normal tracking-tight text-fg-strong">
                    eval-kit
                  </span>
                  <span className="text-2xs text-fg-muted-2">
                    local · v{APP_VERSION}
                  </span>
                </div>
              </a>
            }
            footer={
              <button
                type="button"
                onClick={openPalette}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs text-fg-muted transition-colors hover:bg-bg-elev-2/60 hover:text-fg"
              >
                <span>Command palette</span>
                <div className="flex gap-1">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </div>
              </button>
            }
          />
        }
        topbar={
          <>
            <SessionTracker />
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted-2 transition-colors hover:bg-bg-elev-2 hover:text-fg"
              aria-label="Keyboard shortcuts"
            >
              <Keyboard size={13} strokeWidth={1.5} />
            </button>
            <HelpMenu
              onShowShortcuts={() => setShortcutsOpen(true)}
              appVersion={APP_VERSION}
            />
          </>
        }
      >
        {children}
      </AppShell>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        actions={actions}
        router={router}
      />

      <ShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          className:
            "!bg-bg-elev !border !border-border !text-fg !shadow-lg !rounded-lg",
        }}
      />
    </>
  );
}

function ShortcutsOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-bg-elev p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[14px] font-normal tracking-tight text-fg-strong">
          Keyboard shortcuts
        </div>
        <div className="mt-4 space-y-4 text-xs text-fg-muted">
          <Section title="Navigation">
            <Row label="Open command palette" keys={["⌘", "K"]} />
            {NAV_ITEMS.filter((n) => n.shortcut).map((n) => (
              <Row
                key={n.id}
                label={`Go to ${n.label}`}
                keys={(n.shortcut ?? "").split(" ")}
              />
            ))}
          </Section>
          <Section title="Review page">
            <Row label="Next step" keys={["J"]} />
            <Row label="Previous step" keys={["K"]} />
            <Row label="Set golden truth" keys={["0", "1", "2", "3"]} />
          </Section>
          <Section title="Help">
            <Row label="Show this sheet" keys={["?"]} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-2xs uppercase tracking-wider text-fg-muted-2">
        {title}
      </div>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Row({ label, keys }: { label: string; keys: string[] }) {
  return (
    <li className="flex items-center justify-between gap-3 text-fg-muted">
      <span>{label}</span>
      <div className="flex gap-1">
        {keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </div>
    </li>
  );
}
