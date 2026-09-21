use std::io::Cursor;
#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};

use futures_util::StreamExt;
use tauri::{AppHandle, Manager};

use super::{ffmpeg_name, ffprobe_name, ytdlp_name};
use crate::error::{Error, Result};

fn bin_dir(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| dirs::data_dir().unwrap_or_else(|| PathBuf::from(".")).join("OmniGrab"));
    base.join("bin")
}

fn find_in_path(name: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        let p = dir.join(name);
        if p.is_file() {
            return Some(p);
        }
    }
    None
}

fn mark_exec(p: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        std::fs::set_permissions(p, std::fs::Permissions::from_mode(0o755))?;
    }
    #[cfg(not(unix))]
    {
        let _ = p;
    }
    Ok(())
}

fn local_version(bin: &Path) -> Option<String> {
    let out = std::process::Command::new(bin).arg("--version").output().ok()?;
    if !out.status.success() {
        return None;
    }
    let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if v.is_empty() {
        None
    } else {
        Some(v)
    }
}

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("OmniGrab/0.1.0")
        .build()
        .expect("http client")
}

async fn download_bytes(url: &str) -> Result<Vec<u8>> {
    let mut out = Vec::new();
    let mut stream = client().get(url).send().await?.error_for_status()?.bytes_stream();
    while let Some(chunk) = stream.next().await {
        out.extend_from_slice(&chunk?);
    }
    Ok(out)
}

fn place_file(app: &AppHandle, name: &str, data: &[u8]) -> Result<PathBuf> {
    let dir = bin_dir(app);
    std::fs::create_dir_all(&dir)?;
    let tmp = dir.join(format!("{name}.part"));
    let dst = dir.join(name);
    std::fs::write(&tmp, data)?;
    mark_exec(&tmp)?;
    if dst.exists() {
        let _ = std::fs::remove_file(&dst);
    }
    std::fs::rename(&tmp, &dst)?;
    Ok(dst)
}

fn find_in_zip(buf: &[u8], want: &str) -> Result<Vec<u8>> {
    let mut zip = zip::ZipArchive::new(Cursor::new(buf))?;
    for i in 0..zip.len() {
        let mut f = zip.by_index(i)?;
        if f.is_file() && f.name().ends_with(want) {
            let mut data = Vec::with_capacity(f.size() as usize);
            std::io::copy(&mut f, &mut data)?;
            return Ok(data);
        }
    }
    Err(Error::msg(format!("{want} not found in archive")))
}

fn find_in_tar_xz(buf: &[u8], want: &str) -> Result<Vec<u8>> {
    let dec = xz2::read::XzDecoder::new(Cursor::new(buf));
    let mut ar = tar::Archive::new(dec);
    for entry in ar.entries()? {
        let mut e = entry?;
        let p = e.path()?.to_string_lossy().into_owned();
        if e.header().entry_type().is_file() && p.ends_with(want) {
            let mut data = Vec::new();
            std::io::copy(&mut e, &mut data)?;
            return Ok(data);
        }
    }
    Err(Error::msg(format!("{want} not found in archive")))
}

async fn latest_ytdlp_asset() -> Result<(String, String)> {
    #[derive(serde::Deserialize)]
    struct Rel {
        tag_name: String,
        assets: Vec<Asset>,
    }
    #[derive(serde::Deserialize)]
    struct Asset {
        name: String,
        browser_download_url: String,
    }
    let rel: Rel = client()
        .get("https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let want = if cfg!(windows) {
        "yt-dlp.exe"
    } else if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else {
        "yt-dlp"
    };
    let url = rel
        .assets
        .iter()
        .find(|a| a.name == want)
        .map(|a| a.browser_download_url.clone())
        .ok_or_else(|| Error::msg("yt-dlp asset missing in latest release"))?;
    Ok((rel.tag_name, url))
}

fn ffmpeg_sources() -> (&'static str, &'static str) {
    if cfg!(windows) {
        (
            "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip",
            "zip",
        )
    } else if cfg!(target_os = "macos") {
        ("https://evermeet.cx/ffmpeg/getrelease/zip", "zip")
    } else {
        #[cfg(target_arch = "aarch64")]
        {
            (
                "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz",
                "tar",
            )
        }
        #[cfg(not(target_arch = "aarch64"))]
        {
            (
                "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz",
                "tar",
            )
        }
    }
}

pub fn locate_ytdlp(app: &AppHandle) -> Option<PathBuf> {
    let local = bin_dir(app).join(ytdlp_name());
    if local.is_file() {
        return Some(local);
    }
    find_in_path(ytdlp_name())
}

pub async fn ensure_ytdlp(app: &AppHandle, update: bool) -> Result<PathBuf> {
    if let Some(p) = locate_ytdlp(app) {
        if !update {
            return Ok(p);
        }
        if let Ok((tag, url)) = latest_ytdlp_asset().await {
            let cur = local_version(&p).unwrap_or_default();
            if cur.as_str() >= tag.as_str() {
                return Ok(p);
            }
            let data = download_bytes(&url).await?;
            return place_file(app, ytdlp_name(), &data);
        }
        return Ok(p);
    }
    let (_, url) = latest_ytdlp_asset().await?;
    let data = download_bytes(&url).await?;
    place_file(app, ytdlp_name(), &data)
}

pub fn locate_ffmpeg(app: &AppHandle) -> Option<PathBuf> {
    let local = bin_dir(app).join(ffmpeg_name());
    if local.is_file() {
        return Some(local);
    }
    find_in_path(ffmpeg_name())
}

pub async fn ensure_ffmpeg(app: &AppHandle) -> Result<Option<PathBuf>> {
    if let Some(p) = locate_ffmpeg(app) {
        return Ok(Some(p));
    }
    let (url, kind) = ffmpeg_sources();
    let buf = download_bytes(url).await?;

    let dir = bin_dir(app);
    std::fs::create_dir_all(&dir)?;

    let ff = if kind == "zip" {
        find_in_zip(&buf, ffmpeg_name())?
    } else {
        find_in_tar_xz(&buf, ffmpeg_name())?
    };
    let ffmpeg_path = place_file(app, ffmpeg_name(), &ff)?;

    if cfg!(windows) && kind == "zip" {
        if let Ok(probe) = find_in_zip(&buf, ffprobe_name()) {
            let _ = place_file(app, ffprobe_name(), &probe);
        }
    }
    if cfg!(target_os = "macos") {
        let probe_url = "https://evermeet.cx/ffmpeg/getrelease/ffprobe/zip";
        if let Ok(pb) = download_bytes(probe_url).await {
            if let Ok(probe) = find_in_zip(&pb, ffprobe_name()) {
                let _ = place_file(app, ffprobe_name(), &probe);
            }
        }
    }
    Ok(Some(ffmpeg_path))
}

pub fn ffmpeg_dir(app: &AppHandle) -> Option<PathBuf> {
    locate_ffmpeg(app).and_then(|p| p.parent().map(|d| d.to_path_buf()))
}

pub async fn ensure_all(app: &AppHandle) -> Result<(PathBuf, Option<PathBuf>)> {
    let ytdlp = ensure_ytdlp(app, false).await?;
    let ffdir = match ensure_ffmpeg(app).await {
        Ok(_) => ffmpeg_dir(app),
        Err(_) => ffmpeg_dir(app),
    };
    Ok((ytdlp, ffdir))
}

pub async fn update_all(app: &AppHandle) -> Result<crate::models::BinariesInfo> {
    let ytdlp = ensure_ytdlp(app, true).await?;
    let _ = ensure_ffmpeg(app).await;
    Ok(crate::models::BinariesInfo {
        ytdlp_version: local_version(&ytdlp),
        ffmpeg_ready: locate_ffmpeg(app).is_some(),
    })
}
