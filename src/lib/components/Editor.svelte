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
    defaultHighlightStyle,
  } from "@codemirror/language";
  import { codemirrorExtensions, type Lang } from "$lib/lang";

  type Props = {
    value: string;
    onChange: (value: string) => void;
    dark?: boolean;
    fontSize?: number;
    lang?: Lang;
  };

  let { value, onChange, dark = false, fontSize = 13, lang = "json" }: Props = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  const themeCompartment = new Compartment();
  const fontCompartment = new Compartment();
  const langCompartment = new Compartment();

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
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        langCompartment.of(codemirrorExtensions(lang)),
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

  export function focus() {
    view?.focus();
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
