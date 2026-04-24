<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { MergeView } from "@codemirror/merge";
  import { EditorState } from "@codemirror/state";
  import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
  import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
  import { codemirrorExtensions, type Lang } from "$lib/lang";

  type Props = {
    left: string;
    right: string;
    leftTitle: string;
    rightTitle: string;
    lang: Lang;
    dark?: boolean;
    fontSize?: number;
  };

  let { left, right, leftTitle, rightTitle, lang, dark = false, fontSize = 13 }: Props = $props();

  let host: HTMLDivElement;
  let mergeView: MergeView | null = null;

  function baseExtensions() {
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      foldGutter(),
      bracketMatching(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...codemirrorExtensions(lang),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": { backgroundColor: "var(--bg)", color: "var(--fg)", height: "100%", fontSize: `${fontSize}px` },
        ".cm-gutters": { background: "var(--bg-elev)", borderRight: "1px solid var(--border)", color: "var(--fg-faint)" },
        ".cm-activeLineGutter, .cm-activeLine": { background: "color-mix(in oklab, var(--accent) 8%, transparent)" },
      }, { dark }),
    ];
  }

  onMount(() => {
    mergeView = new MergeView({
      a: { doc: left, extensions: baseExtensions() },
      b: { doc: right, extensions: baseExtensions() },
      parent: host,
      collapseUnchanged: { margin: 3, minSize: 6 },
      gutter: true,
      revertControls: undefined,
    });
  });

  onDestroy(() => {
    mergeView?.destroy();
    mergeView = null;
  });

  // Re-create the MergeView when either side or lang changes.
  $effect(() => {
    if (!host) return;
    void left; void right; void lang; void dark; void fontSize;
    if (mergeView) {
      mergeView.destroy();
      mergeView = new MergeView({
        a: { doc: left, extensions: baseExtensions() },
        b: { doc: right, extensions: baseExtensions() },
        parent: host,
        collapseUnchanged: { margin: 3, minSize: 6 },
        gutter: true,
      });
    }
  });
</script>

<div class="diff-wrap">
  <div class="diff-titles">
    <div class="side" title={leftTitle}><span class="label">A</span><span class="name">{leftTitle}</span></div>
    <div class="side" title={rightTitle}><span class="label">B</span><span class="name">{rightTitle}</span></div>
  </div>
  <div class="diff-host" bind:this={host}></div>
</div>

<style>
  .diff-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg);
    font-family: var(--font-mono);
  }
  .diff-titles {
    display: flex;
    height: 26px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
    font-size: 11px;
    font-family: var(--font-ui);
    color: var(--fg-muted);
    flex-shrink: 0;
  }
  .side {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border-right: 1px solid var(--border);
    overflow: hidden;
  }
  .side:last-child { border-right: none; }
  .label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 3px;
    background: color-mix(in oklab, var(--accent) 22%, transparent);
    color: var(--fg);
    font-weight: 700;
    font-size: 10px;
    flex-shrink: 0;
  }
  .name {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    color: var(--fg);
  }
  .diff-host { flex: 1; min-height: 0; overflow: hidden; }
  :global(.cm-mergeView) { height: 100%; }
  :global(.cm-mergeViewEditors) { height: 100%; }
  :global(.cm-mergeViewEditor) { height: 100%; }
  :global(.cm-deletedChunk) {
    background: color-mix(in oklab, var(--danger) 14%, transparent);
  }
  :global(.cm-insertedLine) {
    background: color-mix(in oklab, var(--ok) 14%, transparent);
  }
  :global(.cm-deletedLine) {
    background: color-mix(in oklab, var(--danger) 14%, transparent);
  }
  :global(.cm-changeGutter) { background: var(--bg-elev); }
</style>
