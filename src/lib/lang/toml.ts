import * as TOML from "smol-toml";
import {
  lineColFromOffset,
  type FormatResult,
  type IndentSpec,
  type ParseResult,
} from "./types";

type TomlError = Error & { line?: number; column?: number; codeblock?: string };

export function parseTOML(text: string): ParseResult {
  if (text.trim() === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: TOML.parse(text) };
  } catch (e) {
    const err = e as TomlError;
    const line = typeof err.line === "number" ? err.line : 1;
    const column = typeof err.column === "number" ? err.column : 1;
    // smol-toml's error reports line/col directly; we derive offset too.
    let offset = 0;
    let l = 1;
    for (let i = 0; i < text.length; i++) {
      if (l === line) {
        offset = i + Math.max(0, column - 1);
        break;
      }
      if (text.charCodeAt(i) === 10) l++;
    }
    return {
      ok: false,
      message: err.message,
      line,
      column,
      offset,
    };
  }
}

export function formatTOML(text: string, _indent: IndentSpec = 2): FormatResult {
  try {
    const value = TOML.parse(text);
    return { ok: true, text: TOML.stringify(value) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

/** TOML is line-oriented — "minify" just round-trips the default stringifier. */
export function minifyTOML(text: string): FormatResult {
  return formatTOML(text);
}

export function stringifyTOMLValue(value: unknown, _indent: IndentSpec = 2): string {
  return TOML.stringify(value as Record<string, unknown>);
}

// Suppress unused-param warnings — lineColFromOffset is re-exported for parity.
void lineColFromOffset;
