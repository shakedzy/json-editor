use std::path::PathBuf;
use std::sync::Mutex;

use serde::Serialize;
use tauri::{Emitter, Manager, State};

#[derive(Serialize)]
pub struct OpenedFile {
    pub path: String,
    pub name: String,
    pub contents: String,
}

#[tauri::command]
pub fn read_file(path: String) -> Result<OpenedFile, String> {
    let p = PathBuf::from(&path);
    let contents = std::fs::read_to_string(&p).map_err(|e| e.to_string())?;
    let name = p
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    Ok(OpenedFile {
        path,
        name,
        contents,
    })
}

#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    std::fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn emit_menu_event(app: tauri::AppHandle, event: String) -> Result<(), String> {
    app.emit("menu", event).map_err(|e| e.to_string())
}

/// Queue of file paths that macOS asked us to open (via Finder double-click,
/// "Open With", or `open -a`). These arrive via `RunEvent::Opened`, which on
/// cold start fires BEFORE the webview's `open-file` listener is wired up —
/// so we buffer them here and let the frontend drain the queue on mount.
#[derive(Default)]
pub struct PendingOpenPaths(pub Mutex<Vec<String>>);

pub fn push_pending_open_path(app: &tauri::AppHandle, path: String) {
    if let Some(state) = app.try_state::<PendingOpenPaths>() {
        if let Ok(mut q) = state.0.lock() {
            q.push(path.clone());
        }
    }
    // Also emit live — for hot opens, a listener is already attached.
    let _ = app.emit("open-file", path);
}

#[tauri::command]
pub fn drain_pending_open_files(state: State<'_, PendingOpenPaths>) -> Vec<String> {
    let mut q = match state.0.lock() {
        Ok(g) => g,
        Err(p) => p.into_inner(),
    };
    std::mem::take(&mut *q)
}
