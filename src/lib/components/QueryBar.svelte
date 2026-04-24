<script lang="ts">
  import { tabs } from "$lib/stores/tabs.svelte";
  import { runJq } from "$lib/query/jq";
  import { runJsonPath } from "$lib/query/jsonpath";

  type Props = {
    onResult: (output: string | null, error: string | null) => void;
  };
  let { onResult }: Props = $props();

  let running = $state(false);
  let historyIndex = $state(-1);

  async function run() {
    const tab = tabs.active;
    const q = tab.query.trim();
    if (!q) {
      onResult(null, null);
      return;
    }
    running = true;
    try {
      if (!tab.parse.ok) {
        onResult(null, "Source document has parse errors — fix them first.");
        return;
      }
      if (tab.queryLang === "jq") {
        // jq operates on JSON; feed it a JSON stringification of the parsed
        // value so YAML/TOML sources work seamlessly. For JSON sources, skip
        // the round-trip and pass tab.text directly.
        const inputJson =
          tab.lang === "json" ? tab.text : JSON.stringify(tab.parse.value);
        const res = await runJq(inputJson, q);
        if (res.ok) onResult(res.output, null);
        else onResult(null, res.error);
      } else {
        const res = runJsonPath(tab.parse.value, q);
        if (res.ok) onResult(res.output, null);
        else onResult(null, res.error);
      }
      tabs.pushQueryHistory(q);
      historyIndex = -1;
    } finally {
      running = false;
    }
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run();
      return;
    }
    const h = tabs.active.queryHistory;
    if (e.key === "ArrowUp" && h.length > 0) {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, h.length - 1);
      historyIndex = next;
      tabs.updateActive({ query: h[next] });
      return;
    }
    if (e.key === "ArrowDown" && historyIndex > -1) {
      e.preventDefault();
      const next = historyIndex - 1;
      historyIndex = next;
      tabs.updateActive({ query: next < 0 ? "" : h[next] });
      return;
    }
  }

  function clear() {
    tabs.updateActive({ query: "" });
    onResult(null, null);
  }

  const placeholder = $derived(
    tabs.active.queryLang === "jq"
      ? ".users[] | select(.age > 30)"
      : "$..name"
  );
</script>

<div class="querybar">
  <div class="langbox">
    <select
      value={tabs.active.queryLang}
      onchange={(e) =>
        tabs.updateActive({
          queryLang: (e.currentTarget as HTMLSelectElement).value as "jq" | "jsonpath",
        })}
    >
      <option value="jq">jq</option>
      <option value="jsonpath">JSONPath</option>
    </select>
  </div>
  <input
    class="input"
    type="text"
    spellcheck={false}
    autocorrect="off"
    autocomplete="off"
    autocapitalize="off"
    {placeholder}
    value={tabs.active.query}
    oninput={(e) => tabs.updateActive({ query: (e.currentTarget as HTMLInputElement).value })}
    onkeydown={onKey}
  />
  {#if tabs.active.query}
    <button class="icon" onclick={clear} title="Clear">✕</button>
  {/if}
  <button class="run" onclick={run} disabled={running} title="Run (⌘↩)">
    {running ? "…" : "Run"}
  </button>
</div>

<style>
  .querybar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 8px;
    background: var(--bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .langbox select {
    height: 24px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 0 6px;
    color: var(--fg);
    font-size: 12px;
  }
  .input {
    flex: 1;
    height: 24px;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--bg-elev);
    padding: 0 8px;
    outline: none;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--fg);
  }
  .input:focus { border-color: var(--accent); }
  .run {
    height: 24px;
    padding: 0 12px;
    background: var(--accent);
    color: var(--accent-fg);
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
  }
  .run:disabled { opacity: 0.5; }
  .icon {
    width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--fg-muted);
    border-radius: 4px;
  }
  .icon:hover { background: var(--bg-elev-2); color: var(--fg); }
</style>
