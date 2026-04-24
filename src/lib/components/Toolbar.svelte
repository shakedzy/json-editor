<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import { tabs } from "$lib/stores/tabs.svelte";
  import { supportsMinify } from "$lib/lang";
  import LangPicker from "./LangPicker.svelte";

  type Props = {
    onFormat: () => void;
    onMinify: () => void;
    onValidate: () => void;
    onToggleTree: () => void;
    onToggleQuery: () => void;
    onPreferences: () => void;
    onOpen: () => void;
    onSave: () => void;
  };
  let {
    onFormat,
    onMinify,
    onValidate,
    onToggleTree,
    onToggleQuery,
    onPreferences,
    onOpen,
    onSave,
  }: Props = $props();

  const canMinify = $derived(supportsMinify(tabs.active.lang));

  function cycleTheme() {
    const order = ["system", "light", "dark"] as const;
    const i = order.indexOf(settings.value.theme);
    settings.update({ theme: order[(i + 1) % order.length] });
  }
</script>

<div class="toolbar">
  <div class="group">
    <button class="btn" onclick={onOpen} title="Open file (⌘O)">Open</button>
    <button class="btn" onclick={onSave} title="Save (⌘S)">Save</button>
  </div>
  <div class="sep"></div>
  <div class="group">
    <button class="btn" onclick={onFormat} title="Format (⌘⇧F)">Format</button>
    {#if canMinify}
      <button class="btn" onclick={onMinify} title="Minify (⌘⇧M)">Minify</button>
    {/if}
    <button class="btn" onclick={onValidate} title="Validate (⌘⇧V)">Validate</button>
  </div>
  <div class="sep"></div>
  <LangPicker />
  <div class="spacer"></div>
  <div class="group">
    <button
      class="btn toggle"
      class:active={settings.value.showQueryBar}
      onclick={onToggleQuery}
      title="Toggle query bar (⌘⇧Q)"
    >Query</button>
    <button
      class="btn toggle"
      class:active={settings.value.showTreePane}
      onclick={onToggleTree}
      title="Toggle tree pane (⌘⇧T)"
    >Tree</button>
  </div>
  <div class="sep"></div>
  <div class="group">
    <button class="btn icon" onclick={cycleTheme} title="Theme: {settings.value.theme}">
      {#if settings.value.theme === "light"}☀{:else if settings.value.theme === "dark"}🌙{:else}🖥{/if}
    </button>
    <button class="btn icon" onclick={onPreferences} title="Preferences (⌘,)">⚙</button>
  </div>
</div>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    padding: 0 8px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .group { display: flex; gap: 2px; }
  .spacer { flex: 1; }
  .sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }
  .btn {
    padding: 4px 10px;
    height: 24px;
    border-radius: 5px;
    color: var(--fg);
    font-size: 12px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .btn:hover { background: var(--bg-elev-2); }
  .btn.icon { padding: 0; width: 26px; justify-content: center; font-size: 13px; }
  .btn.toggle.active {
    background: color-mix(in oklab, var(--accent) 18%, transparent);
    color: var(--fg);
  }
</style>
