mod commands;
mod error;
mod models;
mod ytdlp;

use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

use ytdlp::download::DownloadManager;

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn looks_like_url(s: &str) -> bool {
    let t = s.trim();
    t.starts_with("http://") || t.starts_with("https://")
}

async fn quick_download(app: AppHandle) {
    let text = match arboard::Clipboard::new().and_then(|mut c| c.get_text()) {
        Ok(t) => t,
        Err(_) => return,
    };
    if !looks_like_url(&text) {
        return;
    }
    let save_dir = commands::default_save_dir().unwrap_or_else(|| ".".into());
    let req = models::DownloadRequest {
        url: text.trim().to_string(),
        format: "best".into(),
        merge_ext: Some("mp4".into()),
        proxy: None,
        title: None,
        save_dir,
    };
    let mgr = app.state::<Arc<DownloadManager>>().inner().clone();
    let _ = mgr.start(app, req).await;
}

fn tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show OmniGrab", true, None::<&str>)?;
    let paste = MenuItem::with_id(app, "paste", "Download from clipboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &paste, &quit])?;
    let icon = app
        .default_window_icon()
        .cloned()
        .expect("app icon in bundle");

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("OmniGrab")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, e| match e.id.as_ref() {
            "show" => show_main(app),
            "paste" => {
                let h = app.clone();
                tauri::async_runtime::spawn(async move { quick_download(h).await });
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, e| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = e
            {
                show_main(tray.app_handle());
            }
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(DownloadManager::default_arc())
        .invoke_handler(tauri::generate_handler![
            commands::fetch_metadata,
            commands::start_download,
            commands::cancel_download,
            commands::open_file_location,
            commands::default_save_dir,
            commands::ytdlp_version,
            commands::update_binaries,
        ])
        .setup(|app| {
            let h = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = ytdlp::binary::ensure_ytdlp(&h, true).await;
            });
            tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("omnigrab failed to start");
}
