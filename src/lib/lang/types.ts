export type Lang = "json" | "yaml" | "toml";

export type IndentSpec = 2 | 4 | "tab";

export type ParseOk = { ok: true; value: unknown };

export type ParseErr = {
  ok: false;
  message: string;
  line: number;
  column: number;
  offset: number;
};

export type ParseResult = ParseOk | ParseErr;

export type FormatOk = { ok: true; text: string };
export type FormatErr = { ok: false; message: string };
export type FormatResult = FormatOk | FormatErr;

export const LANGS: readonly Lang[] = ["json", "yaml", "toml"] as const;

export const LANG_LABEL: Record<Lang, string> = {
  json: "JSON",
  yaml: "YAML",
  toml: "TOML",
};

export const LANG_EXTENSIONS: Record<Lang, string[]> = {
  json: ["json", "jsonc", "geojson", "map"],
  yaml: ["yaml", "yml"],
  toml: ["toml"],
};

/** Indent arg for JSON.stringify / yaml.stringify. */
export function indentArg(indent: IndentSpec): string | number {
  return indent === "tab" ? "\t" : indent;
}

/** Convert a 0-based byte offset into a 1-based line/column pair. */
export function lineColFromOffset(
  text: string,
  offset: number
): { line: number; column: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, column: col };
}
