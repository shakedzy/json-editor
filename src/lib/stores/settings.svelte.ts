import type { IndentSpec, Lang } from "$lib/lang";

export type ThemeMode = "system" | "light" | "dark";

export type Settings = {
  theme: ThemeMode;
  fontSize: number;
  indent: IndentSpec;
  defaultQueryLang: "jq" | "jsonpath";
  defaultLang: Lang;
  autoFormatOnPaste: boolean;
  showTreePane: boolean;
  showQueryBar: boolean;
};

const DEFAULTS: Settings = {
  theme: "system",
  fontSize: 13,
  indent: 2,
  defaultQueryLang: "jq",
  defaultLang: "json",
  autoFormatOnPaste: true,
  showTreePane: true,
  showQueryBar: true,
};

const KEY = "json-editor.settings";

function load(): Settings {
  if (typeof localStorage === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

class SettingsStore {
  value = $state<Settings>(load());

  update(patch: Partial<Settings>) {
    this.value = { ...this.value, ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(this.value));
    } catch {
      // ignore
    }
  }

  reset() {
    this.value = { ...DEFAULTS };
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  }
}

export const settings = new SettingsStore();
