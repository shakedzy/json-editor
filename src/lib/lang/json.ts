import {
  indentArg,
  lineColFromOffset,
  type FormatResult,
  type IndentSpec,
  type ParseResult,
} from "./types";

function offsetFromMessage(msg: string): number | null {
  const m =
    msg.match(/position (\d+)/i) ??
    msg.match(/at position (\d+)/i) ??
    msg.match(/at line \d+ column \d+ \(char (\d+)\)/i);
  return m ? Number(m[1]) : null;
}

export function parseJSON(text: string): ParseResult {
  if (text.trim() === "") return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const offset = offsetFromMessage(message) ?? 0;
    const { line, column } = lineColFromOffset(text, offset);
    return {
      ok: false,
      message: message.replace(/in JSON at position \d+( \(line \d+ column \d+\))?$/i, "").trim(),
      line,
      column,
      offset,
    };
  }
}

export function formatJSON(text: string, indent: IndentSpec = 2): FormatResult {
  try {
    const value = JSON.parse(text);
    return { ok: true, text: JSON.stringify(value, null, indentArg(indent)) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export function minifyJSON(text: string): FormatResult {
  try {
    return { ok: true, text: JSON.stringify(JSON.parse(text)) };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}

export function stringifyJSONValue(value: unknown, indent: IndentSpec = 2): string {
  return JSON.stringify(value, null, indentArg(indent));
}
