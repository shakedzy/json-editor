export type PathSegment = string | number;

const SIMPLE_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export function toJsonPath(segments: PathSegment[]): string {
  if (segments.length === 0) return "$";
  let out = "$";
  for (const seg of segments) {
    if (typeof seg === "number") {
      out += `[${seg}]`;
    } else if (SIMPLE_KEY.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `[${JSON.stringify(seg)}]`;
    }
  }
  return out;
}

export function typeOfValue(value: unknown): "object" | "array" | "string" | "number" | "boolean" | "null" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "object" | "string" | "number" | "boolean";
}

export function preview(value: unknown, max = 80): string {
  try {
    const s = JSON.stringify(value);
    if (s === undefined) return String(value);
    return s.length > max ? s.slice(0, max - 1) + "…" : s;
  } catch {
    return String(value);
  }
}

export function childCount(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") return Object.keys(value as object).length;
  return 0;
}
