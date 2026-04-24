<script lang="ts">
  import { tabs } from "$lib/stores/tabs.svelte";
  import { allLangs, langLabel, type Lang } from "$lib/lang";

  const active = $derived(tabs.active);

  function onChange(e: Event) {
    const v = (e.currentTarget as HTMLSelectElement).value as Lang;
    tabs.setLang(v);
  }
</script>

<label class="lang-picker" title="Current document format">
  <span class="label">Lang</span>
  <select value={active.lang} onchange={onChange}>
    {#each allLangs() as l (l)}
      <option value={l}>{langLabel(l)}</option>
    {/each}
  </select>
</label>

<style>
  .lang-picker {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: var(--fg-muted);
  }
  select {
    height: 22px;
    padding: 0 4px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg);
    font-size: 11px;
    font-family: inherit;
  }
  select:focus { outline: 1px solid var(--accent); border-color: var(--accent); }
  .label { color: var(--fg-faint); }
</style>
