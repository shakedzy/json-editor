use tauri::{Manager, RunEvent};

mod commands;
mod menu;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(commands::PendingOpenPaths::default())
        .setup(|app| {
            let menu = menu::build_menu(app.handle())?;
            app.set_menu(menu)?;
            app.on_menu_event(|app, event| {
                menu::on_menu_event(app, event.id().as_ref());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            commands::emit_menu_event,
            commands::drain_pending_open_files,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app, event| {
        // macOS fires `RunEvent::Opened` with `urls` when the OS asks us to open
        // documents — Finder double-click, "Open With", or `open -a`. On cold
        // launch this can arrive before the webview has registered its
        // `open-file` listener, so we also buffer paths in app state and let
        // the frontend drain them on mount via `drain_pending_open_files`.
        if let RunEvent::Opened { urls } = event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_focus();
                    }
                    commands::push_pending_open_path(app, path.to_string_lossy().to_string());
                }
            }
        }
    });
}
