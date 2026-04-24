/**
 * Given a path of segments into the parsed value, return the [offset, length]
 * in the source text where that node lives. Used to scroll + select the
 * corresponding range in the editor when the user clicks a tree row.
 *
 *   JSON  — exact, via jsonc-parser's `parseTree` + `findNodeAtLocation`
 *   YAML  — exact, via the `yaml` Document's `getIn(..., true)` with .range
 *   TOML  — best-effort, via a regex scan (smol-toml doesn't track positions)
 */
import { findNodeAtLocation, parseTree, type Node as JsonNode } from "jsonc-parser";
import YAML, { isNode, isPair, type Node as YamlNode } from "yaml";
import type { PathSegment } from "$lib/json/path";
import type { Lang } from "./types";

export type Location = { offset: number; length: number };

export function locatePath(
  text: string,
  lang: Lang,
  segments: PathSegment[]
): Location | null {
  if (text.length === 0) return null;
  switch (lang) {
    case "json":
      return locateJson(text, segments);
    case "yaml":
      return locateYaml(text, segments);
    case "toml":
      return locateToml(text, segments);
  }
}

function locateJson(text: string, segments: PathSegment[]): Location | null {
  try {
    const root = parseTree(text, [], { allowTrailingComma: true });
    if (!root) return null;
    if (segments.length === 0) {
      return { offset: root.offset, length: root.length };
    }
    const node: JsonNode | undefined = findNodeAtLocation(
      root,
      segments as (string | number)[]
    );
    if (!node) return null;
    return { offset: node.offset, length: node.length };
  } catch {
    return null;
  }
}

function locateYaml(text: string, segments: PathSegment[]): Location | null {
  try {
    const doc = YAML.parseDocument(text);
    if (segments.length === 0) {
      const r = (doc.contents as unknown as { range?: [number, number, number] })?.range;
      return r ? { offset: r[0], length: Math.max(0, r[1] - r[0]) } : null;
    }
    const node = doc.getIn(segments, true);
    if (isNode(node)) {
      const r = (node as YamlNode & { range?: [number, number, number] }).range;
      if (r) return { offset: r[0], length: Math.max(0, r[1] - r[0]) };
    }
    if (isPair(node)) {
      const r = (node.key as { range?: [number, number, number] } | null)?.range;
      if (r) return { offset: r[0], length: Math.max(0, r[1] - r[0]) };
    }
    return null;
  } catch {
    return null;
  }
}

function locateToml(text: string, segments: PathSegment[]): Location | null {
  if (segments.length === 0) return { offset: 0, length: 0 };
  // Last segment: the leaf key/index. Array indices skip out — no position
  // info without tracking; user will just see no selection jump.
  const last = segments[segments.length - 1];
  if (typeof last === "number") return null;

  // Scope the search to the relevant table, if the path names one. For a path
  // like ["stats", "downloads"], look for the `[stats]` header first, then
  // find `downloads =` after it.
  const stringParents = segments.slice(0, -1).filter((s) => typeof s === "string") as string[];
  let scopeStart = 0;
  if (stringParents.length > 0) {
    // Try exact `[a.b.c]` first, then prefix matches like `[a.b]` or `[a]`.
    for (let depth = stringParents.length; depth >= 1; depth--) {
      const dotted = stringParents.slice(0, depth).map(escapeDottedKey).join(".");
      const headerRe = new RegExp(`^\\s*\\[{1,2}${dotted}\\]{1,2}\\s*$`, "m");
      const m = headerRe.exec(text);
      if (m) {
        scopeStart = m.index + m[0].length;
        break;
      }
    }
  }

  // Search for `key =` on its own line (allow leading whitespace, allow the
  // key to be quoted).
  const haystack = text.slice(scopeStart);
  const keyRe = new RegExp(
    `^\\s*(?:"${escapeRegex(last)}"|'${escapeRegex(last)}'|${escapeRegex(last)})\\s*=`,
    "m"
  );
  const km = keyRe.exec(haystack);
  if (!km) return null;
  return { offset: scopeStart + km.index, length: km[0].length };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** TOML table-header keys can be bare, quoted, or dotted. Best-effort escape. */
function escapeDottedKey(s: string): string {
  return escapeRegex(s);
}
