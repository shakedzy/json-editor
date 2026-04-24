use tauri::{
    menu::{AboutMetadata, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Manager, Wry,
};

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let pkg = &app.package_info();

    // App menu
    let about_meta = AboutMetadata {
        name: Some(pkg.name.clone()),
        version: Some(pkg.version.to_string()),
        copyright: Some("© 2026 Shaked Z".into()),
        ..Default::default()
    };

    let app_submenu = SubmenuBuilder::new(app, &pkg.name)
        .item(&PredefinedMenuItem::about(
            app,
            Some(&format!("About {}", pkg.name)),
            Some(about_meta),
        )?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("preferences", "Preferences…")
                .accelerator("Cmd+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    // File menu
    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id("file.new", "New Tab")
                .accelerator("Cmd+T")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file.open", "Open…")
                .accelerator("Cmd+O")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("file.close", "Close Tab")
                .accelerator("Cmd+W")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file.save", "Save")
                .accelerator("Cmd+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("file.save_as", "Save As…")
                .accelerator("Cmd+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("file.compare", "Compare With…")
                .accelerator("Cmd+Shift+D")
                .build(app)?,
        )
        .build()?;

    // Edit menu
    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(
            &MenuItemBuilder::with_id("edit.find", "Find…")
                .accelerator("Cmd+F")
                .build(app)?,
        )
        .build()?;

    // View menu
    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("view.format", "Format JSON")
                .accelerator("Cmd+Shift+F")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view.minify", "Minify JSON")
                .accelerator("Cmd+Shift+M")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view.validate", "Validate")
                .accelerator("Cmd+Shift+V")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("view.toggle_tree", "Toggle Tree Pane")
                .accelerator("Cmd+Shift+T")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("view.toggle_query", "Toggle Query Bar")
                .accelerator("Cmd+Shift+Q")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::fullscreen(app, None)?)
        .build()?;

    // Window menu
    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
        ])
        .build()?;

    Ok(menu)
}

pub fn on_menu_event(app: &AppHandle, event_id: &str) {
    let _ = app.emit("menu", event_id);

    // Keep window focused for shortcut re-entry
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
}
