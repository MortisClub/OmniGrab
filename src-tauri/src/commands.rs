use std::sync::Arc;

use tauri::{AppHandle, State};

use crate::error::{Error, Result};
use crate::models::{BinariesInfo, DownloadRequest, DownloadStarted, MediaInfo};
use crate::ytdlp::{binary, download::DownloadManager, metadata};

#[tauri::command]
pub async fn fetch_metadata(
    app: AppHandle,
    url: String,
    proxy: Option<String>,
    cookies: Option<String>,
) -> Result<MediaInfo> {
    metadata::fetch(&app, url.trim(), proxy.as_deref(), cookies.as_deref()).await
}

#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    mgr: State<'_, Arc<DownloadManager>>,
    request: DownloadRequest,
) -> Result<DownloadStarted> {
    if request.url.trim().is_empty() {
        return Err(Error::msg("empty url"));
    }
    mgr.start(app, request).await
}

#[tauri::command]
pub fn cancel_download(mgr: State<'_, Arc<DownloadManager>>, id: String) -> bool {
    mgr.cancel(&id)
}

#[tauri::command]
pub fn open_file_location(path: String) -> Result<()> {
    #[cfg(windows)]
    std::process::Command::new("explorer")
        .args(["/select,", &path])
        .status()?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .args(["-R", &path])
        .status()?;
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let dir = std::path::Path::new(&path)
            .parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        std::process::Command::new("xdg-open").arg(&dir).status()?;
    }
    Ok(())
}

#[tauri::command]
pub fn default_save_dir() -> Option<String> {
    dirs::download_dir()
        .or_else(dirs::home_dir)
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn ytdlp_version(app: AppHandle) -> Option<String> {
    binary::locate_ytdlp(&app).and_then(|p| {
        std::process::Command::new(p)
            .arg("--version")
            .output()
            .ok()
            .filter(|o| o.status.success())
            .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
    })
}

#[tauri::command]
pub async fn update_binaries(app: AppHandle) -> Result<BinariesInfo> {
    binary::update_all(&app).await
}
