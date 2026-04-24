<script lang="ts">
  import { tabs } from "$lib/stores/tabs.svelte";
  import { countNodes, langLabel, schemaLabel } from "$lib/lang";

  const active = $derived(tabs.active);

  const sizeBytes = $derived(
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(active.text).length
      : active.text.length
  );

  const nodeCount = $derived(active.parse.ok ? countNodes(active.parse.value) : 0);

  function fmtBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="statusbar">
  <span class="lang-chip">{langLabel(active.lang)}</span>
  {#if active.parse.ok}
    <span class="ok">● Valid</span>
  {:else}
    <span class="err">● Error — line {active.parse.line}, col {active.parse.column}: {active.parse.message || `Invalid ${langLabel(active.lang)}`}</span>
  {/if}

  {#if active.selectedPath}
    <span class="sep">·</span>
    <span class="path" title={active.selectedPath}>{active.selectedPath}</span>
  {/if}

  {#if active.schemaUrl}
    <span class="sep">·</span>
    <span class="schema-chip" title={`Schema: ${active.schemaUrl}${active.schema ? "" : " (loading…)"}`} class:loading={!active.schema}>
      ⌖ {schemaLabel(active.schemaUrl)}
    </span>
  {/if}

  <span class="spacer"></span>

  <span class="dim">{fmtBytes(sizeBytes)}</span>
  {#if active.parse.ok}
    <span class="sep">·</span>
    <span class="dim">{nodeCount.toLocaleString()} nodes</span>
  {/if}
  {#if active.path}
    <span class="sep">·</span>
    <span class="dim file" title={active.path}>{active.path}</span>
  {/if}
</div>

<style>
  .statusbar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 10px;
    background: var(--bg-elev);
    border-top: 1px solid var(--border);
    font-size: 11px;
    color: var(--fg-muted);
    flex-shrink: 0;
    font-family: var(--font-mono);
  }
  .lang-chip {
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    height: 16px;
    border-radius: 3px;
    background: color-mix(in oklab, var(--accent) 16%, transparent);
    color: var(--fg);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .ok { color: var(--ok); }
  .err { color: var(--danger); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .path {
    color: var(--fg);
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .schema-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 6px;
    height: 16px;
    border-radius: 3px;
    background: color-mix(in oklab, var(--ok) 14%, transparent);
    color: var(--fg);
    font-size: 10px;
    font-weight: 600;
  }
  .schema-chip.loading {
    background: color-mix(in oklab, var(--fg-faint) 14%, transparent);
    color: var(--fg-muted);
  }
  .spacer { flex: 1; }
  .dim { color: var(--fg-faint); }
  .sep { color: var(--fg-faint); }
  .file {
    max-width: 50%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
  }
</style>
