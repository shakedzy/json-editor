<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
  import { EditorState, Compartment } from "@codemirror/state";
  import { lintGutter } from "@codemirror/lint";
  import { history, defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
  import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
  import {
    bracketMatching,
    foldGutter,
    foldKeymap,
    indentOnInput,
    syntaxHighlighting,
    HighlightStyle,
  } from "@codemirror/language";
  import { tags as t } from "@lezer/highlight";
  import { codemirrorExtensions, type Lang } from "$lib/lang";
  import { jsonSchema } from "codemirror-json-schema";
  import { yamlSchema } from "codemirror-json-schema/yaml";
  import type { Extension } from "@codemirror/state";

  const appHighlightStyle = HighlightStyle.define([
    { tag: t.propertyName, color: "var(--type-key)" },
    { tag: [t.string, t.special(t.string)], color: "var(--type-string)" },
    { tag: [t.number, t.integer, t.float], color: "var(--type-number)" },
    { tag: t.bool, color: "var(--type-bool)" },
    { tag: t.null, color: "var(--type-null)", fontStyle: "italic" },
    { tag: [t.keyword, t.atom], color: "var(--type-bool)" },
    { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--fg-faint)", fontStyle: "italic" },
    { tag: [t.punctuation, t.separator, t.bracket, t.brace, t.squareBracket, t.paren], color: "var(--fg-muted)" },
    { tag: t.invalid, color: "var(--danger)" },
  ]);

  type JSONSchema = Parameters<typeof jsonSchema>[0];

  type Props = {
    value: string;
    onChange: (value: string) => void;
    dark?: boolean;
    fontSize?: number;
    lang?: Lang;
    /** JSON Schema to apply for validation + autocomplete + hover. */
    schema?: object | null;
  };

  let { value, onChange, dark = false, fontSize = 13, lang = "json", schema = null }: Props = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  const themeCompartment = new Compartment();
  const fontCompartment = new Compartment();
  const langCompartment = new Compartment();
  const schemaCompartment = new Compartment();

  function schemaExtension(lang: Lang, schema: object | null): Extension[] {
    if (!schema) return [];
    if (lang === "json") return jsonSchema(schema as JSONSchema);
    if (lang === "yaml") return yamlSchema(schema as JSONSchema);
    return [];
  }

  function themeExtension(isDark: boolean) {
    return EditorView.theme(
      {
        "&": {
          backgroundColor: isDark ? "var(--bg)" : "var(--bg)",
          color: "var(--fg)",
          height: "100%",
        },
        ".cm-content": { caretColor: "var(--accent)" },
        ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
        "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
          { backgroundColor: "color-mix(in oklab, var(--accent) 30%, transparent)" },
        ".cm-panels": {
          backgroundColor: "var(--bg-elev)",
          color: "var(--fg)",
          borderTop: "1px solid var(--border)",
        },
        ".cm-panels input, .cm-panels button": {
          backgroundColor: "var(--bg)",
          color: "var(--fg)",
          border: "1px solid var(--border-strong)",
          borderRadius: "4px",
          padding: "2px 6px",
        },
        ".cm-tooltip": {
          backgroundColor: "var(--bg-elev)",
          border: "1px solid var(--border)",
          color: "var(--fg)",
        },
        ".cm-diagnostic-error": { borderLeft: "3px solid var(--danger)" },
      },
      { dark: isDark }
    );
  }

  function fontExtension(size: number) {
    return EditorView.theme({ "&": { fontSize: `${size}px` } });
  }

  onMount(() => {
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        history(),
        foldGutter(),
        lintGutter(),
        indentOnInput(),
        bracketMatching(),
        highlightSelectionMatches(),
        search({ top: true }),
        syntaxHighlighting(appHighlightStyle, { fallback: true }),
        langCompartment.of(codemirrorExtensions(lang)),
        schemaCompartment.of(schemaExtension(lang, schema)),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...foldKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString());
          }
        }),
        EditorView.lineWrapping,
        themeCompartment.of(themeExtension(dark)),
        fontCompartment.of(fontExtension(fontSize)),
      ],
    });

    view = new EditorView({ state, parent: host });
  });

  onDestroy(() => {
    view?.destroy();
    view = null;
  });

  // Sync external value changes into the editor
  $effect(() => {
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  });

  $effect(() => {
    view?.dispatch({
      effects: themeCompartment.reconfigure(themeExtension(dark)),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: fontCompartment.reconfigure(fontExtension(fontSize)),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: langCompartment.reconfigure(codemirrorExtensions(lang)),
    });
  });

  $effect(() => {
    view?.dispatch({
      effects: schemaCompartment.reconfigure(schemaExtension(lang, schema)),
    });
  });

  export function focus() {
    view?.focus();
  }

  /**
   * Scroll to and select the text range [offset, offset+length]. Used by the
   * tree view to "jump to the line for this key" when a node is clicked.
   */
  export function revealOffset(offset: number, length: number) {
    if (!view) return;
    const docLen = view.state.doc.length;
    const from = Math.min(docLen, Math.max(0, offset));
    const to = Math.min(docLen, Math.max(from, from + length));
    view.focus();
    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
  }

  export function openFind() {
    if (!view) return;
    view.focus();
    // CodeMirror's search keymap uses Mod-f; emulate by dispatching
    const ev = new KeyboardEvent("keydown", {
      key: "f",
      code: "KeyF",
      metaKey: true,
      ctrlKey: false,
      bubbles: true,
    });
    view.contentDOM.dispatchEvent(ev);
  }
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--bg);
  }
</style>
