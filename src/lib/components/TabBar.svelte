<script lang="ts">
  import { tabs } from "$lib/stores/tabs.svelte";
</script>

<div class="tabbar">
  <div class="tabs">
    {#each tabs.tabs as tab, i (tab.id)}
      {@const display = tabs.displayTitles[i]}
      {@const match = display.match(/^(.*?)(\s\(.+\))$/)}
      <button
        class="tab"
        class:active={tab.id === tabs.activeId}
        onclick={() => tabs.setActive(tab.id)}
        title={tab.path ?? tab.title}
      >
        {#if match}
          <span class="title"><span class="filename">{match[1]}</span><span class="suffix">{match[2]}</span></span>
        {:else}
          <span class="title"><span class="filename">{display}</span></span>
        {/if}
        {#if tabs.isDirty(tab.id)}
          <span class="dirty">•</span>
        {/if}
        <span
          class="close"
          role="button"
          tabindex="0"
          aria-label="Close tab"
          onclick={(e) => {
            e.stopPropagation();
            tabs.closeTab(tab.id);
          }}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              tabs.closeTab(tab.id);
            }
          }}
        >✕</span>
      </button>
    {/each}
  </div>
  <button class="add" title="New tab" onclick={() => tabs.newTab()}>+</button>
</div>

<style>
  .tabbar {
    display: flex;
    align-items: flex-end;
    height: 34px;
    background: var(--bg-elev);
    border-bottom: 1px solid var(--border);
    padding: 0 6px;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    flex-shrink: 0;
  }
  .tabs {
    display: flex;
    gap: 2px;
    height: 100%;
    align-items: flex-end;
  }
  .tab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 8px 0 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-bottom: none;
    border-top-left-radius: 6px;
    border-top-right-radius: 6px;
    color: var(--fg-muted);
    max-width: 220px;
    min-width: 90px;
    max-width: 280px;
    overflow: hidden;
    font-size: 12px;
  }
  .title .filename { white-space: nowrap; }
  .title .suffix {
    color: var(--fg-faint);
    font-size: 11px;
    margin-left: 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .tab.active {
    background: var(--bg);
    color: var(--fg);
  }
  .title {
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
    flex: 1;
  }
  .dirty {
    color: var(--accent);
    font-size: 16px;
    line-height: 1;
  }
  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    color: var(--fg-faint);
    font-size: 11px;
  }
  .close:hover { background: var(--bg-elev-2); color: var(--fg); }
  .tab.active .close:hover { background: var(--bg-elev); }
  .add {
    height: 26px;
    width: 26px;
    margin-left: 4px;
    margin-bottom: 0;
    border-radius: 6px;
    color: var(--fg-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .add:hover { background: var(--bg-elev-2); color: var(--fg); }
</style>
