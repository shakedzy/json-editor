<script lang="ts">
  type Props = {
    output: string | null;
    error: string | null;
    onClose: () => void;
  };
  let { output, error, onClose }: Props = $props();

  async function copy() {
    if (output == null) return;
    try {
      await navigator.clipboard.writeText(output);
    } catch {}
  }
</script>

<div class="result">
  <div class="head">
    <span class="title">{error ? "Query error" : "Query result"}</span>
    <span class="spacer"></span>
    {#if !error && output !== null}
      <button class="btn" onclick={copy} title="Copy">Copy</button>
    {/if}
    <button class="btn icon" onclick={onClose} aria-label="Close" title="Close">✕</button>
  </div>
  <div class="body" class:err={!!error}>
    {#if error}
      <pre class="pre">{error}</pre>
    {:else}
      <pre class="pre select-text">{output}</pre>
    {/if}
  </div>
</div>

<style>
  .result {
    display: flex; flex-direction: column;
    max-height: 45vh;
    border-top: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .head {
    display: flex; align-items: center; gap: 6px;
    height: 26px; padding: 0 10px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    color: var(--fg-muted);
  }
  .title { font-weight: 600; color: var(--fg); }
  .spacer { flex: 1; }
  .btn {
    height: 20px; padding: 0 8px;
    border-radius: 4px;
    font-size: 11px;
    color: var(--fg);
  }
  .btn:hover { background: var(--bg-elev-2); }
  .btn.icon { padding: 0; width: 22px; display: inline-flex; align-items: center; justify-content: center; }
  .body {
    flex: 1;
    overflow: auto;
    padding: 8px 10px;
    font-family: var(--font-mono);
    font-size: 12px;
  }
  .body.err { color: var(--danger); }
  .pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
