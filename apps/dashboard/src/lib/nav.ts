import {
  BookOpen,
  Bot,
  FileCode,
  GitCompare,
  Home,
  Inbox,
  Network,
  Settings,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

export interface NavDefinition {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  shortcut?: string;
  group?: string;
}

export const NAV_ITEMS: NavDefinition[] = [
  { id: "home", label: "Overview", href: "/", icon: Home, shortcut: "g h", group: "Workspace" },
  { id: "inbox", label: "Inbox", href: "/inbox", icon: Inbox, shortcut: "g i", group: "Workspace" },
  { id: "runs", label: "Runs", href: "/runs", icon: PlayCircle, shortcut: "g r", group: "Workspace" },
  { id: "suites", label: "Suites", href: "/suites", icon: FileCode, shortcut: "g s", group: "Workspace" },
  { id: "agents", label: "Agents", href: "/agents", icon: Bot, shortcut: "g a", group: "Workspace" },
  { id: "adapters", label: "Adapters", href: "/adapters", icon: Network, group: "Reference" },
  { id: "diff", label: "Diff", href: "/diff", icon: GitCompare, shortcut: "g d", group: "Workspace" },
  { id: "docs", label: "Docs", href: "/docs", icon: BookOpen, shortcut: "g ?", group: "Reference" },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings, group: "Reference" },
];

export function groupedNav(): {
  label: string;
  items: NavDefinition[];
}[] {
  const byGroup = new Map<string, NavDefinition[]>();
  for (const item of NAV_ITEMS) {
    const g = item.group ?? "Workspace";
    (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(item);
  }
  return [...byGroup.entries()].map(([label, items]) => ({ label, items }));
}
