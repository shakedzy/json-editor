/**
 * Schema loading for JSON / YAML documents.
 *
 * v0.1.1 shape: auto-detect the `$schema` property at the document root. If
 * it's a URL, fetch + cache it and expose it through the tab state so the
 * Editor can plug codemirror-json-schema's extensions in via a compartment.
 *
 * TOML has no standard JSON-Schema story — skip.
 */
import type { Lang } from "./types";

const cache = new Map<string, object>();
const inflight = new Map<string, Promise<object | null>>();

/** Extract the `$schema` URL from the root of a parsed JSON/YAML value. */
export function extractSchemaRef(value: unknown, lang: Lang): string | null {
  if (lang === "toml") return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const ref = (value as Record<string, unknown>)["$schema"];
  if (typeof ref !== "string") return null;
  return ref.trim() || null;
}

/**
 * Fetch and cache a JSON Schema document. Returns `null` on error (network,
 * non-2xx, invalid JSON) — callers treat "no schema" as "no validation".
 */
export async function loadSchema(url: string): Promise<object | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const existing = inflight.get(url);
  if (existing) return existing;

  const p = (async () => {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return null;
      const text = await res.text();
      const obj = JSON.parse(text) as object;
      cache.set(url, obj);
      return obj;
    } catch {
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

/** Short label for the schema chip in the status bar (host + last path seg). */
export function schemaLabel(url: string): string {
  try {
    const u = new URL(url);
    const tail = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
    return tail.replace(/\.json$/i, "");
  } catch {
    return url.length > 40 ? url.slice(0, 37) + "…" : url;
  }
}
