export type Handler = (e: KeyboardEvent) => void;

const mac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

/** Normalize a shortcut spec like "Cmd+Shift+F" into a lowercase key. */
function normalize(spec: string): string {
  return spec
    .split("+")
    .map((s) => s.trim().toLowerCase())
    .map((s) => {
      if (s === "cmd" || s === "meta" || s === "command") return mac ? "meta" : "ctrl";
      if (s === "ctrl" || s === "control") return "ctrl";
      if (s === "opt" || s === "option" || s === "alt") return "alt";
      if (s === "shift") return "shift";
      if (s === "enter" || s === "return") return "enter";
      return s;
    })
    .sort()
    .join("+");
}

function eventSpec(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.metaKey) parts.push("meta");
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  const key = e.key.toLowerCase();
  if (key !== "meta" && key !== "control" && key !== "alt" && key !== "shift") {
    parts.push(key);
  }
  return parts.sort().join("+");
}

export function bindShortcuts(map: Record<string, Handler>): () => void {
  const normalized: Record<string, Handler> = {};
  for (const [spec, handler] of Object.entries(map)) {
    normalized[normalize(spec)] = handler;
  }
  const listener = (e: KeyboardEvent) => {
    const spec = eventSpec(e);
    const handler = normalized[spec];
    if (handler) {
      handler(e);
    }
  };
  window.addEventListener("keydown", listener);
  return () => window.removeEventListener("keydown", listener);
}
