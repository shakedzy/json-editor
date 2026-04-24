import { JSONPath } from "jsonpath-plus";

export type JsonPathResult =
  | { ok: true; output: string }
  | { ok: false; error: string };

export function runJsonPath(value: unknown, expr: string): JsonPathResult {
  if (!expr.trim()) {
    return { ok: true, output: JSON.stringify(value, null, 2) };
  }
  try {
    const results = JSONPath({ path: expr, json: value as object });
    return { ok: true, output: JSON.stringify(results, null, 2) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
