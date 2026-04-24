/**
 * Sublime-style filename disambiguation.
 *
 * Given any list of `{ title, path }` items, returns a parallel array of
 * display titles. When more than one item shares the same `title`, the
 * shortest unique parent-path suffix is appended in parentheses:
 *
 *   [{ title: "Cargo.toml", path: "/a/src-tauri/Cargo.toml" },
 *    { title: "Cargo.toml", path: "/b/gguf-editor/Cargo.toml" }]
 *     →  ["Cargo.toml (src-tauri)", "Cargo.toml (gguf-editor)"]
 *
 * If the immediate parents also collide ("config" vs "config"), it walks one
 * more level up ("proj-1/config", "proj-2/config") until labels are unique or
 * the shorter path runs out of segments.
 *
 * Items with no `path` can't be disambiguated further and keep their bare
 * title.
 */
export type DisambiguateInput = { title: string; path: string | null };

export function disambiguateTitles(items: readonly DisambiguateInput[]): string[] {
  const byTitle = new Map<string, number[]>();
  for (let i = 0; i < items.length; i++) {
    const arr = byTitle.get(items[i].title) ?? [];
    arr.push(i);
    byTitle.set(items[i].title, arr);
  }

  const result = items.map((t) => t.title);

  for (const [, indices] of byTitle) {
    if (indices.length < 2) continue;

    // Parent-path segments reversed (immediate parent at index 0).
    // `null` means this item has no on-disk path and can't be disambiguated.
    const revSegs: (string[] | null)[] = indices.map((i) => {
      const p = items[i].path;
      if (!p) return null;
      const segs = p.split(/[/\\]/).filter(Boolean);
      segs.pop(); // drop the filename itself
      return segs.reverse();
    });

    let depth = 1;
    let labels: string[] = [];
    while (true) {
      labels = revSegs.map((segs) => {
        if (segs === null) return "";
        const prefix = segs.slice(0, depth).reverse().join("/");
        return prefix ? ` (${prefix})` : "";
      });
      const nonEmpty = labels.filter((l) => l !== "");
      const unique = new Set(nonEmpty).size === nonEmpty.length;
      const canGoDeeper = revSegs.some((s) => s !== null && depth < s.length);
      if (unique || !canGoDeeper) break;
      depth += 1;
    }

    labels.forEach((suffix, k) => {
      result[indices[k]] = `${items[indices[k]].title}${suffix}`;
    });
  }

  return result;
}
