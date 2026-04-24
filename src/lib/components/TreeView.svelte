<script lang="ts">
  import { childCount, toJsonPath, typeOfValue, type PathSegment } from "$lib/json/path";

  type Props = {
    value: unknown;
    selectedPath: string | null;
    onSelect: (path: string) => void;
  };
  let { value, selectedPath, onSelect }: Props = $props();

  // A row is either an "item" (key + value / opening bracket) or a "close"
  // (the matching closing bracket for an expanded container, rendered at the
  // same indent level as the opening row).
  type ItemRow = {
    type: "item";
    key: string | null;
    path: PathSegment[];
    pathKey: string;
    jsonPath: string;
    depth: number;
    value: unknown;
    kind: ReturnType<typeof typeOfValue>;
    isContainer: boolean;
    isLastChild: boolean;
    childCount: number;
  };
  type CloseRow = {
    type: "close";
    pathKey: string;     // same pathKey as the opening row (so click toggles it)
    jsonPath: string;
    depth: number;
    kind: "object" | "array";
    isLastChild: boolean;
  };
  type Row = ItemRow | CloseRow;

  const ROW_HEIGHT = 22;
  const OVERSCAN = 10;

  let expanded = $state<Set<string>>(new Set(["$"]));
  let scrollEl = $state<HTMLDivElement>();
  let scrollTop = $state(0);
  let viewportHeight = $state(400);

  function flatten(root: unknown): Row[] {
    const rows: Row[] = [];

    function pushRow(
      key: string | null,
      path: PathSegment[],
      depth: number,
      v: unknown,
      isLastChild: boolean
    ) {
      const kind = typeOfValue(v);
      const isContainer = kind === "object" || kind === "array";
      const jp = toJsonPath(path);
      const pathKey = jp;

      const cnt = childCount(v);
      rows.push({
        type: "item",
        key,
        path,
        pathKey,
        jsonPath: jp,
        depth,
        value: v,
        kind,
        isContainer,
        isLastChild,
        childCount: cnt,
      });

      if (isContainer && expanded.has(pathKey)) {
        if (kind === "array") {
          const arr = v as unknown[];
          for (let i = 0; i < arr.length; i++) {
            pushRow(String(i), [...path, i], depth + 1, arr[i], i === arr.length - 1);
          }
        } else {
          const obj = v as Record<string, unknown>;
          const keys = Object.keys(obj);
          for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            pushRow(k, [...path, k], depth + 1, obj[k], i === keys.length - 1);
          }
        }
        rows.push({
          type: "close",
          pathKey,
          jsonPath: jp,
          depth,
          kind: kind as "object" | "array",
          isLastChild,
        });
      }
    }

    pushRow(null, [], 0, root, true);
    return rows;
  }

  let rows = $derived(flatten(value));
  let totalSize = $derived(rows.length * ROW_HEIGHT);

  // Hand-rolled windowing — with uniform row height this is simpler and more
  // robust than TanStack's store dance, and there are no re-subscription seams.
  let window_ = $derived.by(() => {
    const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const end = Math.min(
      rows.length,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN
    );
    return { start, end };
  });

  $effect(() => {
    if (!scrollEl) return;
    const onScroll = () => {
      scrollTop = scrollEl!.scrollTop;
    };
    const ro = new ResizeObserver(() => {
      viewportHeight = scrollEl!.clientHeight;
    });
    ro.observe(scrollEl);
    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    viewportHeight = scrollEl.clientHeight;
    scrollTop = scrollEl.scrollTop;
    return () => {
      scrollEl?.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  });

  // ---- Actions ----
  function toggle(pathKey: string) {
    const next = new Set(expanded);
    if (next.has(pathKey)) next.delete(pathKey);
    else next.add(pathKey);
    expanded = next;
  }

  function expandSubtree(row: ItemRow) {
    const next = new Set(expanded);
    function walk(v: unknown, path: PathSegment[]) {
      const jp = toJsonPath(path);
      next.add(jp);
      if (Array.isArray(v)) v.forEach((c, i) => walk(c, [...path, i]));
      else if (v && typeof v === "object")
        for (const k of Object.keys(v as object))
          walk((v as Record<string, unknown>)[k], [...path, k]);
    }
    walk(row.value, row.path);
    expanded = next;
  }

  function collapseSubtree(row: ItemRow) {
    const next = new Set(expanded);
    function walk(v: unknown, path: PathSegment[]) {
      const jp = toJsonPath(path);
      next.delete(jp);
      if (Array.isArray(v)) v.forEach((c, i) => walk(c, [...path, i]));
      else if (v && typeof v === "object")
        for (const k of Object.keys(v as object))
          walk((v as Record<string, unknown>)[k], [...path, k]);
    }
    walk(row.value, row.path);
    expanded = next;
  }

  function copyPath(jsonPath: string) {
    navigator.clipboard?.writeText(jsonPath).catch(() => {});
    onSelect(jsonPath);
  }

  function onRowClick(row: Row, e: MouseEvent) {
    // Cmd/Ctrl-click: always copy path (works on containers too).
    if (e.metaKey || e.ctrlKey) {
      copyPath(row.jsonPath);
      return;
    }
    if (row.type === "close") {
      toggle(row.pathKey);
      return;
    }
    if (row.isContainer) {
      toggle(row.pathKey);
      return;
    }
    // Leaf: select + copy path.
    copyPath(row.jsonPath);
  }

  function onRowDblClick(row: Row, e: MouseEvent) {
    e.preventDefault();
    if (row.type !== "item" || !row.isContainer) return;
    if (expanded.has(row.pathKey)) collapseSubtree(row);
    else expandSubtree(row);
  }

  function expandAll() {
    const next = new Set<string>();
    function walk(v: unknown, path: PathSegment[]) {
      next.add(toJsonPath(path));
      if (Array.isArray(v)) v.forEach((c, i) => walk(c, [...path, i]));
      else if (v && typeof v === "object")
        for (const k of Object.keys(v as object))
          walk((v as Record<string, unknown>)[k], [...path, k]);
    }
    walk(value, []);
    expanded = next;
  }

  function collapseAll() {
    expanded = new Set();
  }

  // Preview text for a closed container.
  function closedPreview(row: ItemRow): string {
    const { kind, childCount: cc } = row;
    if (cc === 0) return kind === "array" ? "[]" : "{}";
    const noun = kind === "array" ? "item" : "key";
    return `${cc} ${noun}${cc === 1 ? "" : "s"}`;
  }
</script>

<div class="tree">
  <div class="tree-head">
    <button onclick={expandAll} title="Expand all">⤋</button>
    <button onclick={collapseAll} title="Collapse all">⤒</button>
    <span class="head-label">{rows.length.toLocaleString()} rows</span>
  </div>
  <div class="tree-scroll" bind:this={scrollEl}>
    <div class="tree-inner" style:height="{totalSize}px">
      {#each rows.slice(window_.start, window_.end) as row, i (row.type + ":" + row.pathKey + ":" + (row.type === "close" ? "c" : "o") + ":" + (window_.start + i))}
        {@const index = window_.start + i}
        {@const top = index * ROW_HEIGHT}
        <div
          class="row"
          class:selected={row.type === "item" && row.jsonPath === selectedPath && !row.isContainer}
          class:container={row.type === "item" && row.isContainer}
          class:closer={row.type === "close"}
          style:transform="translateY({top}px)"
          style:padding-left="{row.depth * 14 + 8}px"
          onclick={(e) => onRowClick(row, e)}
          ondblclick={(e) => onRowDblClick(row, e)}
          role="button"
          tabindex="0"
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(row, e as unknown as MouseEvent); }
          }}
        >
          {#if row.type === "item"}
            {#if row.isContainer}
              <span class="disclosure" aria-hidden="true">{expanded.has(row.pathKey) ? "▾" : "▸"}</span>
            {:else}
              <span class="disclosure placeholder" aria-hidden="true"></span>
            {/if}

            {#if row.key !== null}
              <span class="key">
                {#if typeof row.path[row.path.length - 1] === "number"}
                  <span class="index">{row.key}</span>
                {:else}
                  "{row.key}"
                {/if}<span class="colon">:</span>
              </span>
            {/if}

            {#if row.isContainer}
              {#if row.kind === "array"}
                <span class="bracket">[</span>
                {#if !expanded.has(row.pathKey)}
                  <span class="muted">{closedPreview(row)}</span><span class="bracket">]</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
                {/if}
              {:else}
                <span class="bracket">&#123;</span>
                {#if !expanded.has(row.pathKey)}
                  <span class="muted">{closedPreview(row)}</span><span class="bracket">&#125;</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
                {/if}
              {/if}
            {:else if row.kind === "string"}
              <span class="v-string">"{row.value}"</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
            {:else if row.kind === "number"}
              <span class="v-number">{row.value as number}</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
            {:else if row.kind === "boolean"}
              <span class="v-bool">{String(row.value)}</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
            {:else if row.kind === "null"}
              <span class="v-null">null</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
            {/if}

            <button
              class="copy-btn"
              title="Copy JSONPath — {row.jsonPath}"
              onclick={(e) => { e.stopPropagation(); copyPath(row.jsonPath); }}
              aria-label="Copy JSONPath"
            >⧉</button>
          {:else}
            <span class="disclosure placeholder" aria-hidden="true"></span>
            <span class="bracket">{row.kind === "array" ? "]" : "}"}</span>{#if !row.isLastChild}<span class="comma">,</span>{/if}
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .tree {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background: var(--bg);
    font-family: var(--font-mono);
    font-size: var(--editor-font-size, 13px);
  }
  .tree-head {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 26px;
    padding: 0 6px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-elev);
    font-size: 11px;
    font-family: var(--font-ui);
    color: var(--fg-muted);
    flex-shrink: 0;
  }
  .tree-head button {
    width: 22px; height: 22px; border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--fg-muted);
  }
  .tree-head button:hover { background: var(--bg-elev-2); color: var(--fg); }
  .head-label { margin-left: auto; color: var(--fg-faint); font-family: var(--font-mono); }
  .tree-scroll { flex: 1; overflow: auto; }
  .tree-inner { position: relative; width: 100%; }
  .row {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 22px;
    line-height: 22px;
    display: flex;
    align-items: center;
    gap: 2px;
    padding-right: 36px;
    white-space: nowrap;
    overflow: hidden;
    color: var(--fg);
    cursor: default;
    user-select: none;
  }
  .row.container, .row.closer { cursor: pointer; }
  .row:hover { background: var(--bg-elev); }
  .row.selected { background: color-mix(in oklab, var(--accent) 18%, transparent); }
  .row.container:hover .disclosure { color: var(--fg); }
  .row .copy-btn {
    margin-left: auto;
    width: 22px; height: 18px;
    border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--fg-faint);
    font-size: 12px;
    opacity: 0;
    transition: opacity 120ms;
    flex-shrink: 0;
  }
  .row:hover .copy-btn { opacity: 1; }
  .row .copy-btn:hover { background: var(--bg-elev-2); color: var(--fg); }
  .disclosure {
    width: 14px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    color: var(--fg-muted);
    flex-shrink: 0;
    pointer-events: none;
  }
  .disclosure.placeholder { background: transparent; }
  .key { color: var(--type-key); }
  .key .index { color: var(--fg-muted); }
  .colon { color: var(--fg-muted); margin-left: 0; }
  .bracket { color: var(--fg-muted); margin-left: 4px; }
  .muted { color: var(--fg-faint); margin: 0 4px; font-style: italic; }
  .comma { color: var(--fg-faint); }
  .v-string { color: var(--type-string); overflow: hidden; text-overflow: ellipsis; margin-left: 4px; }
  .v-number { color: var(--type-number); margin-left: 4px; }
  .v-bool { color: var(--type-bool); margin-left: 4px; }
  .v-null { color: var(--type-null); font-style: italic; margin-left: 4px; }
</style>
