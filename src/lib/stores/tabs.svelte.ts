import { langFromPath, parse, type Lang, type ParseResult } from "$lib/lang";

export type QueryLang = "jq" | "jsonpath";

export type Tab = {
  id: string;
  title: string;
  path: string | null;
  text: string;
  savedText: string;
  lang: Lang;
  queryLang: QueryLang;
  query: string;
  queryOutput: string | null;
  queryError: string | null;
  queryHistory: string[];
  selectedPath: string | null;
  parse: ParseResult;
};

let counter = 0;
function nextId(): string {
  counter += 1;
  return `tab-${Date.now()}-${counter}`;
}

function makeTab(partial: Partial<Tab> = {}): Tab {
  const text = partial.text ?? "";
  const lang: Lang = partial.lang ?? "json";
  return {
    id: nextId(),
    title: partial.title ?? "Untitled",
    path: partial.path ?? null,
    text,
    savedText: partial.savedText ?? text,
    lang,
    queryLang: partial.queryLang ?? "jq",
    query: partial.query ?? "",
    queryOutput: null,
    queryError: null,
    queryHistory: partial.queryHistory ?? [],
    selectedPath: null,
    parse: parse(text, lang),
    ...partial,
  };
}

/**
 * Sublime-style tab disambiguation.
 *
 * Given the current tab list, returns a parallel array of display titles. When
 * more than one tab shares the same filename, the shortest unique parent-path
 * suffix is appended in parentheses, e.g. `Cargo.toml (src-tauri)` vs
 * `Cargo.toml (gguf-editor/src-tauri)`. Tabs with no path (e.g. "Untitled")
 * can't be disambiguated further and keep their bare title.
 */
function computeDisplayTitles(tabs: Tab[]): string[] {
  const byTitle = new Map<string, number[]>();
  for (let i = 0; i < tabs.length; i++) {
    const arr = byTitle.get(tabs[i].title) ?? [];
    arr.push(i);
    byTitle.set(tabs[i].title, arr);
  }

  const result = tabs.map((t) => t.title);

  for (const [, indices] of byTitle) {
    if (indices.length < 2) continue;

    // Parent-path segments reversed (immediate parent at index 0).
    // `null` means this tab has no on-disk path and can't be disambiguated.
    const revSegs: (string[] | null)[] = indices.map((i) => {
      const p = tabs[i].path;
      if (!p) return null;
      const segs = p.split(/[/\\]/).filter(Boolean);
      segs.pop(); // drop the filename itself
      return segs.reverse();
    });

    let depth = 1;
    let labels: string[] = [];
    while (true) {
      labels = revSegs.map((segs) => {
        if (segs === null) return "";
        const prefix = segs.slice(0, depth).reverse().join("/");
        return prefix ? ` (${prefix})` : "";
      });
      const nonEmpty = labels.filter((l) => l !== "");
      const unique = new Set(nonEmpty).size === nonEmpty.length;
      const canGoDeeper = revSegs.some((s) => s !== null && depth < s.length);
      if (unique || !canGoDeeper) break;
      depth += 1;
    }

    labels.forEach((suffix, k) => {
      result[indices[k]] = `${tabs[indices[k]].title}${suffix}`;
    });
  }

  return result;
}

class TabsStore {
  tabs = $state<Tab[]>([makeTab()]);
  activeId = $state<string>(this.tabs[0].id);

  active = $derived<Tab>(this.tabs.find((t) => t.id === this.activeId) ?? this.tabs[0]);

  /** Parallel array to `tabs` with Sublime-style disambiguated display titles. */
  displayTitles = $derived<string[]>(computeDisplayTitles(this.tabs));

  newTab(partial?: Partial<Tab>) {
    const t = makeTab(partial);
    this.tabs = [...this.tabs, t];
    this.activeId = t.id;
    return t;
  }

  closeTab(id: string) {
    const idx = this.tabs.findIndex((t) => t.id === id);
    if (idx < 0) return;
    const remaining = this.tabs.filter((t) => t.id !== id);
    if (remaining.length === 0) {
      const fresh = makeTab();
      this.tabs = [fresh];
      this.activeId = fresh.id;
      return;
    }
    this.tabs = remaining;
    if (this.activeId === id) {
      const next = remaining[Math.min(idx, remaining.length - 1)];
      this.activeId = next.id;
    }
  }

  setActive(id: string) {
    if (this.tabs.some((t) => t.id === id)) this.activeId = id;
  }

  setActiveByIndex(i: number) {
    const t = this.tabs[i];
    if (t) this.activeId = t.id;
  }

  updateActive(patch: Partial<Tab>) {
    this.tabs = this.tabs.map((t) =>
      t.id === this.activeId ? { ...t, ...patch } : t
    );
  }

  setText(text: string) {
    this.tabs = this.tabs.map((t) =>
      t.id === this.activeId
        ? { ...t, text, parse: parse(text, t.lang) }
        : t
    );
  }

  setLang(lang: Lang) {
    this.tabs = this.tabs.map((t) =>
      t.id === this.activeId
        ? { ...t, lang, parse: parse(t.text, lang) }
        : t
    );
  }

  markSaved(path: string, title: string) {
    this.tabs = this.tabs.map((t) =>
      t.id === this.activeId
        ? {
            ...t,
            path,
            title,
            savedText: t.text,
            lang: langFromPath(path) ?? t.lang,
          }
        : t
    );
  }

  loadFile(path: string, title: string, contents: string) {
    const existing = this.tabs.find((t) => t.path === path);
    if (existing) {
      this.activeId = existing.id;
      return;
    }
    const lang = langFromPath(path) ?? "json";
    const active = this.active;
    const isActiveEmpty = active.text.trim() === "" && active.path === null;
    if (isActiveEmpty) {
      this.tabs = this.tabs.map((t) =>
        t.id === active.id
          ? {
              ...t,
              title,
              path,
              text: contents,
              savedText: contents,
              lang,
              parse: parse(contents, lang),
            }
          : t
      );
      return;
    }
    this.newTab({ title, path, text: contents, savedText: contents, lang });
  }

  isDirty(id?: string): boolean {
    const t = id ? this.tabs.find((x) => x.id === id) : this.active;
    return !!t && t.text !== t.savedText;
  }

  pushQueryHistory(q: string) {
    const h = this.active.queryHistory.filter((x) => x !== q);
    h.unshift(q);
    this.updateActive({ queryHistory: h.slice(0, 50) });
  }
}

export const tabs = new TabsStore();
