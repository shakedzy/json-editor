<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import { allLangs, langLabel, type Lang } from "$lib/lang";

  type Props = {
    open: boolean;
    onClose: () => void;
  };
  let { open, onClose }: Props = $props();

  function onBackdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if open}
  <div class="backdrop" onclick={onBackdrop} role="presentation">
    <div class="modal" role="dialog" aria-modal="true" aria-label="Preferences">
      <div class="head">
        <h2>Preferences</h2>
        <button class="x" onclick={onClose} aria-label="Close">✕</button>
      </div>
      <div class="body">
        <label class="row">
          <span>Theme</span>
          <select
            value={settings.value.theme}
            onchange={(e) =>
              settings.update({ theme: (e.currentTarget as HTMLSelectElement).value as "system" | "light" | "dark" })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label class="row">
          <span>Font size</span>
          <input
            type="number"
            min="10"
            max="24"
            step="1"
            value={settings.value.fontSize}
            oninput={(e) => {
              const n = Number((e.currentTarget as HTMLInputElement).value);
              if (!Number.isNaN(n)) settings.update({ fontSize: n });
            }}
          />
        </label>
        <label class="row">
          <span>Indent</span>
          <select
            value={String(settings.value.indent)}
            onchange={(e) => {
              const v = (e.currentTarget as HTMLSelectElement).value;
              settings.update({ indent: v === "tab" ? "tab" : (Number(v) as 2 | 4) });
            }}
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
        <label class="row">
          <span>Default document format</span>
          <select
            value={settings.value.defaultLang}
            onchange={(e) =>
              settings.update({ defaultLang: (e.currentTarget as HTMLSelectElement).value as Lang })}
          >
            {#each allLangs() as l (l)}
              <option value={l}>{langLabel(l)}</option>
            {/each}
          </select>
        </label>
        <label class="row">
          <span>Default query language</span>
          <select
            value={settings.value.defaultQueryLang}
            onchange={(e) =>
              settings.update({ defaultQueryLang: (e.currentTarget as HTMLSelectElement).value as "jq" | "jsonpath" })}
          >
            <option value="jq">jq</option>
            <option value="jsonpath">JSONPath</option>
          </select>
        </label>
        <label class="row check">
          <input
            type="checkbox"
            checked={settings.value.autoFormatOnPaste}
            onchange={(e) => settings.update({ autoFormatOnPaste: (e.currentTarget as HTMLInputElement).checked })}
          />
          <span>Auto-format on paste</span>
        </label>
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed; inset: 0;
    background: color-mix(in oklab, black 45%, transparent);
    display: grid; place-items: center;
    z-index: 1000;
  }
  .modal {
    width: 380px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 20px 60px color-mix(in oklab, black 40%, transparent);
    overflow: hidden;
  }
  .head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
  }
  h2 { margin: 0; font-size: 13px; font-weight: 600; }
  .x {
    width: 24px; height: 24px; border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--fg-muted);
  }
  .x:hover { background: var(--bg-elev-2); color: var(--fg); }
  .body { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
  .row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px;
    font-size: 12px;
  }
  .row.check { justify-content: flex-start; gap: 8px; }
  select, input[type="number"] {
    height: 24px;
    padding: 0 6px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg);
    font-size: 12px;
    min-width: 130px;
  }
  input[type="number"] { width: 80px; min-width: 0; }
</style>
