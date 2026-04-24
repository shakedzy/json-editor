import {
  extractSchemaRef,
  langFromPath,
  loadSchema,
  parse,
  type Lang,
  type ParseResult,
} from "$lib/lang";
import { disambiguateTitles } from "$lib/util/disambiguate";

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
  /** URL of the active JSON Schema, if any (auto-detected from `$schema`). */
  schemaUrl: string | null;
  /** Fetched schema document, if loaded. `null` while pending or on failure. */
  schema: object | null;
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
    schemaUrl: null,
    schema: null,
    ...partial,
  };
}

/**
 * Sublime-style tab disambiguation. Delegates to the shared
 * `disambiguateTitles` helper in `$lib/util/disambiguate` so the diff view's
 * compare header can use the same logic on its own two-item list.
 */
function computeDisplayTitles(tabs: Tab[]): string[] {
  return disambiguateTitles(tabs.map((t) => ({ title: t.title, path: t.path })));
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
    if (this.tabs.some((t) => t.id === id)) {
      this.activeId = id;
      this.#reconcileSchema();
    }
  }

  setActiveByIndex(i: number) {
    const t = this.tabs[i];
    if (t) {
      this.activeId = t.id;
      this.#reconcileSchema();
    }
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
    this.#reconcileSchema();
  }

  /**
   * Look at the active tab's parsed value, pull out `$schema` if present, and
   * fetch+attach the schema asynchronously. Idempotent — if the URL hasn't
   * changed since the last call, nothing happens.
   */
  #reconcileSchema() {
    const t = this.active;
    const nextUrl = t.parse.ok ? extractSchemaRef(t.parse.value, t.lang) : null;
    if (nextUrl === t.schemaUrl) return;
    // Clear the old binding eagerly.
    this.tabs = this.tabs.map((x) =>
      x.id === t.id ? { ...x, schemaUrl: nextUrl, schema: null } : x
    );
    if (!nextUrl) return;
    const targetId = t.id;
    void loadSchema(nextUrl).then((schema) => {
      this.tabs = this.tabs.map((x) =>
        x.id === targetId && x.schemaUrl === nextUrl ? { ...x, schema } : x
      );
    });
  }

  setLang(lang: Lang) {
    this.tabs = this.tabs.map((t) =>
      t.id === this.activeId
        ? { ...t, lang, parse: parse(t.text, lang) }
        : t
    );
    this.#reconcileSchema();
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
      this.#reconcileSchema();
      return;
    }
    this.newTab({ title, path, text: contents, savedText: contents, lang });
    this.#reconcileSchema();
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
