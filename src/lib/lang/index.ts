import { Compartment, type Extension } from "@codemirror/state";
import { json as cmJson, jsonParseLinter } from "@codemirror/lang-json";
import { yaml as cmYaml } from "@codemirror/lang-yaml";
import { StreamLanguage } from "@codemirror/language";
import { toml as cmTomlLegacy } from "@codemirror/legacy-modes/mode/toml";
import { linter, type Diagnostic } from "@codemirror/lint";

import { parseJSON, formatJSON, minifyJSON, stringifyJSONValue } from "./json";
import { parseYAML, formatYAML, minifyYAML, stringifyYAMLValue } from "./yaml";
import { parseTOML, formatTOML, minifyTOML, stringifyTOMLValue } from "./toml";
import {
  LANG_EXTENSIONS,
  LANG_LABEL,
  LANGS,
  type FormatResult,
  type IndentSpec,
  type Lang,
  type ParseResult,
} from "./types";

export * from "./types";

export function parse(text: string, lang: Lang): ParseResult {
  switch (lang) {
    case "json":
      return parseJSON(text);
    case "yaml":
      return parseYAML(text);
    case "toml":
      return parseTOML(text);
  }
}

export function format(text: string, lang: Lang, indent: IndentSpec = 2): FormatResult {
  switch (lang) {
    case "json":
      return formatJSON(text, indent);
    case "yaml":
      return formatYAML(text, indent);
    case "toml":
      return formatTOML(text, indent);
  }
}

export function minify(text: string, lang: Lang): FormatResult {
  switch (lang) {
    case "json":
      return minifyJSON(text);
    case "yaml":
      return minifyYAML(text);
    case "toml":
      return minifyTOML(text);
  }
}

/** TOML has no meaningful minification — the toolbar uses this to hide/disable the button. */
export function supportsMinify(lang: Lang): boolean {
  return lang !== "toml";
}

export function stringifyValue(value: unknown, lang: Lang, indent: IndentSpec = 2): string {
  switch (lang) {
    case "json":
      return stringifyJSONValue(value, indent);
    case "yaml":
      return stringifyYAMLValue(value, indent);
    case "toml":
      return stringifyTOMLValue(value, indent);
  }
}

export function langLabel(lang: Lang): string {
  return LANG_LABEL[lang];
}

export function allLangs(): readonly Lang[] {
  return LANGS;
}

export function langFromExt(ext: string): Lang | null {
  const normalized = ext.toLowerCase().replace(/^\./, "");
  for (const lang of LANGS) {
    if (LANG_EXTENSIONS[lang].includes(normalized)) return lang;
  }
  return null;
}

export function langFromPath(path: string): Lang | null {
  const i = path.lastIndexOf(".");
  if (i < 0) return null;
  return langFromExt(path.slice(i + 1));
}

/** Shared parse-based linter for languages without a native CodeMirror linter. */
function parseLinter(lang: Lang) {
  return linter((view) => {
    const text = view.state.doc.toString();
    if (text.trim() === "") return [] as Diagnostic[];
    const res = parse(text, lang);
    if (res.ok) return [];
    const from = Math.min(view.state.doc.length, Math.max(0, res.offset));
    const to = Math.min(view.state.doc.length, from + 1);
    return [
      {
        from,
        to,
        severity: "error",
        message: res.message,
      },
    ];
  });
}

/** Tolerant JSON linter — no diagnostics on empty input (prevents a noisy gutter on boot). */
function tolerantJsonLinter() {
  return linter((view) => {
    if (view.state.doc.length === 0 || view.state.doc.toString().trim() === "") {
      return [] as Diagnostic[];
    }
    return jsonParseLinter()(view);
  });
}

export function codemirrorExtensions(lang: Lang): Extension[] {
  switch (lang) {
    case "json":
      return [cmJson(), tolerantJsonLinter()];
    case "yaml":
      return [cmYaml(), parseLinter("yaml")];
    case "toml":
      return [StreamLanguage.define(cmTomlLegacy), parseLinter("toml")];
  }
}

/** Helper for components that need to reconfigure the language compartment. */
export function makeLangCompartment(initial: Lang): {
  compartment: Compartment;
  initialExtensions: Extension[];
} {
  const compartment = new Compartment();
  return { compartment, initialExtensions: codemirrorExtensions(initial) };
}

/** Node count for any parsed value (format-agnostic). Used by StatusBar. */
export function countNodes(value: unknown): number {
  if (value === null) return 1;
  if (Array.isArray(value)) {
    let n = 1;
    for (const v of value) n += countNodes(v);
    return n;
  }
  if (typeof value === "object") {
    let n = 1;
    for (const k in value as Record<string, unknown>) {
      n += countNodes((value as Record<string, unknown>)[k]);
    }
    return n;
  }
  return 1;
}
