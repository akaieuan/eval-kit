export function isMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}

export function modLabel(): string {
  return isMac() ? "⌘" : "Ctrl";
}

export function shortcutLabel(keys: string[]): string {
  return keys
    .map((k) => (k === "mod" ? modLabel() : k.toUpperCase()))
    .join(" ");
}
