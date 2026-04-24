<script lang="ts">
  import "../app.css";
  import { onMount } from "svelte";
  import { listen } from "@tauri-apps/api/event";
  import { invoke } from "@tauri-apps/api/core";
  import { getCurrentWebview } from "@tauri-apps/api/webview";
  import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
  import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

  import TabBar from "$lib/components/TabBar.svelte";
  import Toolbar from "$lib/components/Toolbar.svelte";
  import QueryBar from "$lib/components/QueryBar.svelte";
  import Editor from "$lib/components/Editor.svelte";
  import TreeView from "$lib/components/TreeView.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import ResultPane from "$lib/components/ResultPane.svelte";
  import PreferencesDialog from "$lib/components/PreferencesDialog.svelte";
  import DiffView from "$lib/components/DiffView.svelte";

  import { tabs } from "$lib/stores/tabs.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { recents } from "$lib/stores/recents.svelte";
  import {
    format,
    langFromPath,
    langLabel,
    LANG_EXTENSIONS,
    locatePath,
    minify,
    parse,
    supportsMinify,
  } from "$lib/lang";
  import type { PathSegment } from "$lib/json/path";
  import { applyTheme, watchSystemTheme } from "$lib/util/theme";
  import { bindShortcuts } from "$lib/util/shortcuts";
  import { disambiguateTitles } from "$lib/util/disambiguate";

  let editorRef = $state<{
    focus: () => void;
    openFind: () => void;
    revealOffset: (offset: number, length: number) => void;
  } | null>(null);
  let showPrefs = $state(false);

  const active = $derived(tabs.active);
  const dark = $derived.by(() => {
    if (settings.value.theme === "dark") return true;
    if (settings.value.theme === "light") return false;
    return typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false;
  });

  $effect(() => { applyTheme(settings.value.theme); });

  $effect(() => {
    document.documentElement.style.setProperty("--editor-font-size", `${settings.value.fontSize}px`);
  });

  // ---- Actions ----
  function formatAction() {
    const res = format(active.text, active.lang, settings.value.indent);
    if (res.ok) tabs.setText(res.text);
  }

  function minifyAction() {
    if (!supportsMinify(active.lang)) return;
    const res = minify(active.text, active.lang);
    if (res.ok) tabs.setText(res.text);
  }

  function validateAction() {
    const r = parse(active.text, active.lang);
    if (r.ok) {
      document.body.animate(
        [{ background: "var(--bg)" }, { background: "color-mix(in oklab, var(--ok) 22%, var(--bg))" }, { background: "var(--bg)" }],
        { duration: 600 }
      );
    }
  }

  async function loadPath(path: string) {
    try {
      const contents = await readTextFile(path);
      const name = path.split("/").pop() || path;
      tabs.loadFile(path, name, contents);
      recents.push(path);
    } catch (e) {
      console.error(e);
    }
  }

  async function openFile() {
    const selected = await openDialog({
      multiple: false,
      filters: [
        {
          name: "Supported",
          extensions: [...LANG_EXTENSIONS.json, ...LANG_EXTENSIONS.yaml, ...LANG_EXTENSIONS.toml],
        },
        { name: "JSON", extensions: LANG_EXTENSIONS.json as string[] },
        { name: "YAML", extensions: LANG_EXTENSIONS.yaml as string[] },
        { name: "TOML", extensions: LANG_EXTENSIONS.toml as string[] },
      ],
    });
    if (!selected || Array.isArray(selected)) return;
    await loadPath(selected);
  }

  async function saveFile(saveAs = false) {
    let path = active.path;
    if (!path || saveAs) {
      const exts = LANG_EXTENSIONS[active.lang] as string[];
      const defaultName =
        active.title === "Untitled" ? `Untitled.${exts[0]}` : active.title;
      const selected = await saveDialog({
        defaultPath: defaultName,
        filters: [{ name: langLabel(active.lang), extensions: exts }],
      });
      if (!selected) return;
      path = selected;
    }
    try {
      await writeTextFile(path, active.text);
      const name = path.split("/").pop() || path;
      tabs.markSaved(path, name);
      recents.push(path);
    } catch (e) {
      console.error(e);
    }
  }

  // ---- Query result ----
  let queryOutput = $state<string | null>(null);
  let queryError = $state<string | null>(null);

  // ---- Diff view ----
  let diffState = $state<{
    leftTitle: string;
    rightTitle: string;
    left: string;
    right: string;
    lang: import("$lib/lang").Lang;
  } | null>(null);

  async function compareActiveTabWith() {
    const selected = await openDialog({
      multiple: false,
      filters: [
        {
          name: "Supported",
          extensions: [...LANG_EXTENSIONS.json, ...LANG_EXTENSIONS.yaml, ...LANG_EXTENSIONS.toml],
        },
      ],
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      const rightText = await readTextFile(selected);
      const rightTitle = selected.split("/").pop() || selected;
      // Same Sublime-style treatment we use in the tab bar: if the two
      // filenames collide, append the shortest unique parent-path suffix to
      // each so the compare header reads e.g. "Cargo.toml (src-tauri)" vs
      // "Cargo.toml (gguf-editor)".
      const [leftDisplay, rightDisplay] = disambiguateTitles([
        { title: active.title, path: active.path },
        { title: rightTitle, path: selected },
      ]);
      diffState = {
        leftTitle: leftDisplay,
        rightTitle: rightDisplay,
        left: active.text,
        right: rightText,
        lang: langFromPath(selected) ?? active.lang,
      };
    } catch (err) {
      console.error(err);
    }
  }

  function closeDiff() {
    diffState = null;
  }

  function onQueryResult(output: string | null, error: string | null) {
    queryOutput = output;
    queryError = error;
  }

  // ---- Menu events from Rust ----
  let unlistenMenu: (() => void) | null = null;
  let unlistenOpenFile: (() => void) | null = null;

  onMount(() => {
    const offSystemTheme = watchSystemTheme(() => settings.value.theme);

    (async () => {
      unlistenMenu = await listen<string>("menu", (e) => {
        handleMenu(e.payload);
      });
    })();

    // Files that macOS asked us to open via "Open With" / default handler.
    (async () => {
      unlistenOpenFile = await listen<string>("open-file", (e) => {
        if (typeof e.payload === "string" && e.payload.length > 0) {
          loadPath(e.payload);
        }
      });
      // Drain anything buffered on the Rust side before this listener existed
      // (cold launch via Finder double-click fires RunEvent::Opened before the
      // webview boots and registers its listener).
      try {
        const pending = await invoke<string[]>("drain_pending_open_files");
        for (const p of pending) {
          if (typeof p === "string" && p.length > 0) loadPath(p);
        }
      } catch (err) {
        console.error(err);
      }
    })();

    // Drag-drop files
    const webview = getCurrentWebview();
    let dragUnlisten: (() => void) | null = null;
    (async () => {
      dragUnlisten = await webview.onDragDropEvent(async (event) => {
        if (event.payload.type === "drop") {
          for (const path of event.payload.paths) {
            try {
              const contents = await readTextFile(path);
              const name = path.split("/").pop() || path;
              tabs.loadFile(path, name, contents);
              recents.push(path);
            } catch (err) {
              console.error(err);
            }
          }
        }
      });
    })();

    const unbind = bindShortcuts({
      "Cmd+O": (e) => { e.preventDefault(); openFile(); },
      "Cmd+S": (e) => { e.preventDefault(); saveFile(false); },
      "Cmd+Shift+S": (e) => { e.preventDefault(); saveFile(true); },
      "Cmd+T": (e) => { e.preventDefault(); tabs.newTab(); },
      "Cmd+W": (e) => { e.preventDefault(); tabs.closeTab(tabs.activeId); },
      "Cmd+Shift+F": (e) => { e.preventDefault(); formatAction(); },
      "Cmd+Shift+M": (e) => { e.preventDefault(); minifyAction(); },
      "Cmd+Shift+V": (e) => { e.preventDefault(); validateAction(); },
      "Cmd+Shift+T": (e) => { e.preventDefault(); settings.update({ showTreePane: !settings.value.showTreePane }); },
      "Cmd+Shift+Q": (e) => { e.preventDefault(); settings.update({ showQueryBar: !settings.value.showQueryBar }); },
      "Cmd+,": (e) => { e.preventDefault(); showPrefs = true; },
      "Cmd+Shift+D": (e) => { e.preventDefault(); compareActiveTabWith(); },
      "Escape": (e) => { if (diffState) { e.preventDefault(); closeDiff(); } },
      "Cmd+1": (e) => { e.preventDefault(); tabs.setActiveByIndex(0); },
      "Cmd+2": (e) => { e.preventDefault(); tabs.setActiveByIndex(1); },
      "Cmd+3": (e) => { e.preventDefault(); tabs.setActiveByIndex(2); },
      "Cmd+4": (e) => { e.preventDefault(); tabs.setActiveByIndex(3); },
      "Cmd+5": (e) => { e.preventDefault(); tabs.setActiveByIndex(4); },
      "Cmd+6": (e) => { e.preventDefault(); tabs.setActiveByIndex(5); },
      "Cmd+7": (e) => { e.preventDefault(); tabs.setActiveByIndex(6); },
      "Cmd+8": (e) => { e.preventDefault(); tabs.setActiveByIndex(7); },
      "Cmd+9": (e) => { e.preventDefault(); tabs.setActiveByIndex(8); },
    });

    return () => {
      unbind();
      offSystemTheme();
      unlistenMenu?.();
      unlistenOpenFile?.();
      dragUnlisten?.();
    };
  });

  function handleMenu(id: string) {
    switch (id) {
      case "file.new": tabs.newTab(); break;
      case "file.open": openFile(); break;
      case "file.close": tabs.closeTab(tabs.activeId); break;
      case "file.save": saveFile(false); break;
      case "file.save_as": saveFile(true); break;
      case "view.format": formatAction(); break;
      case "view.minify": minifyAction(); break;
      case "view.validate": validateAction(); break;
      case "view.toggle_tree":
        settings.update({ showTreePane: !settings.value.showTreePane }); break;
      case "view.toggle_query":
        settings.update({ showQueryBar: !settings.value.showQueryBar }); break;
      case "edit.find":
        editorRef?.openFind(); break;
      case "preferences":
        showPrefs = true; break;
      case "file.compare":
        compareActiveTabWith(); break;
    }
  }

  // ---- Editor change handling (auto-format on paste) ----
  function onEditorChange(next: string) {
    const prev = tabs.active.text;
    tabs.setText(next);
    if (tabs.active.selectedPath) tabs.updateActive({ selectedPath: null });

    if (settings.value.autoFormatOnPaste && prev.trim() === "" && next.trim() !== "") {
      const r = format(next, tabs.active.lang, settings.value.indent);
      if (r.ok && r.text !== next) {
        tabs.setText(r.text);
      }
    }
  }

  function onTreeSelect(jsonPath: string, segments: PathSegment[]) {
    tabs.updateActive({ selectedPath: jsonPath });
    const tab = tabs.active;
    const loc = locatePath(tab.text, tab.lang, segments);
    if (loc && editorRef) {
      editorRef.revealOffset(loc.offset, loc.length);
    }
  }
</script>

<div class="app" class:dark>
  <TabBar />
  <Toolbar
    onFormat={formatAction}
    onMinify={minifyAction}
    onValidate={validateAction}
    onToggleTree={() => settings.update({ showTreePane: !settings.value.showTreePane })}
    onToggleQuery={() => settings.update({ showQueryBar: !settings.value.showQueryBar })}
    onPreferences={() => (showPrefs = true)}
    onOpen={openFile}
    onSave={() => saveFile(false)}
  />
  {#if settings.value.showQueryBar}
    <QueryBar onResult={onQueryResult} />
  {/if}

  <div class="main">
    {#if diffState}
      <div class="diff-head">
        <span class="diff-title">Compare</span>
        <span class="diff-sub">{diffState.leftTitle} ↔ {diffState.rightTitle}</span>
        <span class="diff-spacer"></span>
        <button class="diff-close" onclick={closeDiff} aria-label="Close diff" title="Close diff (Esc)">✕</button>
      </div>
      <div class="diff-body">
        <DiffView
          left={diffState.left}
          right={diffState.right}
          leftTitle={diffState.leftTitle}
          rightTitle={diffState.rightTitle}
          lang={diffState.lang}
          {dark}
          fontSize={settings.value.fontSize}
        />
      </div>
    {:else}
    <div class="panes">
      <div class="pane editor-pane">
        {#key active.id}
          <Editor
            value={active.text}
            onChange={onEditorChange}
            {dark}
            fontSize={settings.value.fontSize}
            lang={active.lang}
            schema={active.schema}
            bind:this={editorRef}
          />
        {/key}
      </div>
      {#if settings.value.showTreePane}
        <div class="divider"></div>
        <div class="pane tree-pane">
          {#if active.parse.ok && active.parse.value !== undefined}
            {#key active.id}
              <TreeView
                value={active.parse.value}
                selectedPath={active.selectedPath}
                onSelect={onTreeSelect}
              />
            {/key}
          {:else if !active.parse.ok}
            <div class="empty error">
              <p>{langLabel(active.lang)} has errors.</p>
              <p class="small">line {active.parse.line}, column {active.parse.column}</p>
              <p class="small muted">{active.parse.message}</p>
            </div>
          {:else}
            <div class="empty">
              <p>Paste or open a JSON file to see its tree.</p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    {#if queryOutput !== null || queryError !== null}
      <ResultPane
        output={queryOutput}
        error={queryError}
        onClose={() => { queryOutput = null; queryError = null; }}
      />
    {/if}
    {/if}
  </div>

  <StatusBar />
</div>

<PreferencesDialog open={showPrefs} onClose={() => (showPrefs = false)} />

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: var(--bg);
    color: var(--fg);
  }
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .panes {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .pane {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    background: var(--bg);
  }
  .editor-pane { flex: 1; }
  .tree-pane { flex: 1; }
  .divider {
    width: 1px;
    background: var(--border);
    flex-shrink: 0;
  }
  .empty {
    height: 100%;
    display: grid;
    place-content: center;
    text-align: center;
    color: var(--fg-muted);
    font-size: 13px;
    gap: 4px;
    padding: 20px;
  }
  .empty.error p:first-child { color: var(--danger); font-weight: 600; }
  .empty .small { font-size: 12px; }
  .empty .muted { color: var(--fg-faint); max-width: 360px; }

  /* Diff / compare mode */
  .diff-head {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 30px;
    padding: 0 10px;
    background: color-mix(in oklab, var(--accent) 18%, var(--bg-elev));
    border-bottom: 1px solid var(--border);
    font-size: 12px;
    color: var(--fg);
    flex-shrink: 0;
  }
  .diff-title { font-weight: 700; letter-spacing: 0.02em; }
  .diff-sub { color: var(--fg-muted); font-family: var(--font-mono); font-size: 11px; }
  .diff-spacer { flex: 1; }
  .diff-close {
    width: 22px; height: 22px;
    border-radius: 4px;
    display: inline-flex; align-items: center; justify-content: center;
    color: var(--fg-muted);
  }
  .diff-close:hover { background: var(--bg-elev-2); color: var(--fg); }
  .diff-body { flex: 1; min-height: 0; }
</style>
