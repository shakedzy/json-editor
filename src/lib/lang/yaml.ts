import YAML from "yaml";
import {
  indentArg,
  lineColFromOffset,
  type FormatResult,
  type IndentSpec,
  type ParseResult,
} from "./types";

export function parseYAML(text: string): ParseResult {
  if (text.trim() === "") return { ok: true, value: undefined };
  try {
    const doc = YAML.parseDocument(text, { prettyErrors: true });
    if (doc.errors.length > 0) {
      const err = doc.errors[0];
      const offset = err.pos?.[0] ?? 0;
      const { line, column } = lineColFromOffset(text, offset);
      return {
        ok: false,
        message: err.message,
        line,
        column,
        offset,
      };
    }
    return { ok: true, value: doc.toJS({ mapAsMap: false }) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, message, line: 1, column: 1, offset: 0 };
  }
}

/** Pretty-print YAML by round-tripping through the parser. */
export function formatYAML(text: string, indent: IndentSpec = 2): FormatResult {
  try {
    const value = YAML.parse(text);
    const ind = indent === "tab" ? 2 : indent; // YAML spec disallows tabs for indentation
    const out = YAML.stringify(value, { indent: ind, lineWidth: 0 });
    return { ok: true, text: out };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** "Minify" YAML → render as compact JSON (YAML is a superset of JSON, so it round-trips). */
export function minifyYAML(text: string): FormatResult {
  try {
    const value = YAML.parse(text);
    return { ok: true, text: JSON.stringify(value) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export function stringifyYAMLValue(value: unknown, indent: IndentSpec = 2): string {
  const ind = indent === "tab" ? 2 : indent;
  return YAML.stringify(value, { indent: ind, lineWidth: 0 });
}

/** Supress unused arg warning from indentArg (we only use it from the store side). */
void indentArg;
