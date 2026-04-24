use tauri::Manager;

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

            // On Windows / Linux, the OS passes file paths as CLI arguments when
            // the user double-clicks a registered file type. macOS instead
            // dispatches `RunEvent::Opened` (handled below in `app.run`), so we
            // skip the argv scan there to avoid duplicate loads.
            #[cfg(not(target_os = "macos"))]
            {
                let handle = app.handle().clone();
                for arg in std::env::args().skip(1) {
                    if std::path::Path::new(&arg).is_file() {
                        commands::push_pending_open_path(&handle, arg);
                    }
                }
            }

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

    // macOS fires `RunEvent::Opened` with `urls` when the OS asks us to open
    // documents — Finder double-click, "Open With", or `open -a`. On cold
    // launch this can arrive before the webview has registered its
    // `open-file` listener, so we also buffer paths in app state and let the
    // frontend drain them on mount via `drain_pending_open_files`.
    //
    // `RunEvent::Opened` is macOS-only, so this whole arm must be gated.
    #[cfg(target_os = "macos")]
    app.run(|app, event| {
        if let tauri::RunEvent::Opened { urls } = event {
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

    #[cfg(not(target_os = "macos"))]
    app.run(|_app, _event| {});
}
