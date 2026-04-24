const KEY = "json-editor.recents";
const MAX = 10;

function load(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function save(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

class RecentsStore {
  list = $state<string[]>(load());

  push(path: string) {
    const next = [path, ...this.list.filter((x) => x !== path)].slice(0, MAX);
    this.list = next;
    save(next);
  }

  clear() {
    this.list = [];
    save([]);
  }
}

export const recents = new RecentsStore();
