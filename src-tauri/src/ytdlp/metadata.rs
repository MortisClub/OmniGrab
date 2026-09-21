use tauri::AppHandle;

use super::binary;
use crate::error::{Error, Result};
use crate::models::{FormatInfo, MediaInfo};

#[derive(serde::Deserialize)]
struct RawInfo {
    id: serde_json::Value,
    title: Option<String>,
    #[serde(default)]
    uploader: Option<String>,
    #[serde(default)]
    duration: Option<f64>,
    #[serde(default)]
    thumbnail: Option<String>,
    #[serde(default)]
    webpage_url: Option<String>,
    #[serde(default)]
    formats: Vec<RawFormat>,
}

#[derive(serde::Deserialize)]
struct RawFormat {
    format_id: String,
    #[serde(default)]
    ext: Option<String>,
    #[serde(default)]
    height: Option<i64>,
    #[serde(default)]
    width: Option<i64>,
    #[serde(default)]
    fps: Option<f64>,
    #[serde(default)]
    vcodec: Option<String>,
    #[serde(default)]
    acodec: Option<String>,
    #[serde(default)]
    tbr: Option<f64>,
    #[serde(default)]
    filesize: Option<u64>,
    #[serde(default)]
    filesize_approx: Option<u64>,
    #[serde(default)]
    protocol: Option<String>,
    #[serde(default)]
    url: Option<String>,
}

pub async fn fetch(app: &AppHandle, url: &str, proxy: Option<&str>) -> Result<MediaInfo> {
    let bin = binary::ensure_ytdlp(app, false).await?;

    let mut cmd = tokio::process::Command::new(&bin);
    cmd.args([
        "--dump-single-json",
        "--no-playlist",
        "--no-warnings",
        "--socket-timeout",
        "20",
    ]);
    if let Some(p) = proxy.map(str::trim).filter(|p| !p.is_empty()) {
        cmd.args(["--proxy", p]);
    }
    cmd.arg(url);

    let out = cmd.output().await?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(Error::msg(clean_err(&err)));
    }

    let raw: RawInfo = serde_json::from_slice(&out.stdout)?;
    let id = match &raw.id {
        serde_json::Value::String(s) => s.clone(),
        other => other.to_string().trim_matches('"').to_string(),
    };

    let mut fmts: Vec<FormatInfo> = raw
        .formats
        .iter()
        .filter(|f| {
            f.url.is_some()
                && !f.format_id.starts_with("sb")
                && f.format_id != "storyboard"
                && (f.vcodec.is_some() || f.acodec.is_some())
        })
        .map(|f| FormatInfo {
            format_id: f.format_id.clone(),
            ext: f.ext.clone().unwrap_or_else(|| "mp4".into()),
            height: f.height.and_then(|h| u32::try_from(h).ok()),
            width: f.width.and_then(|w| u32::try_from(w).ok()),
            fps: f.fps,
            vcodec: f.vcodec.clone(),
            acodec: f.acodec.clone(),
            tbr: f.tbr,
            filesize: f.filesize.or(f.filesize_approx),
            protocol: f.protocol.clone(),
        })
        .collect();

    fmts.sort_by(|a, b| {
        let va = a.height.unwrap_or(0);
        let vb = b.height.unwrap_or(0);
        vb.cmp(&va)
            .then_with(|| b.tbr.unwrap_or(0.0).partial_cmp(&a.tbr.unwrap_or(0.0)).unwrap())
    });

    Ok(MediaInfo {
        id,
        title: raw.title.unwrap_or_else(|| "Untitled".into()),
        uploader: raw.uploader,
        duration: raw.duration,
        thumbnail: raw.thumbnail,
        webpage_url: raw.webpage_url.unwrap_or_else(|| url.to_string()),
        formats: fmts,
    })
}

fn clean_err(stderr: &str) -> String {
    for line in stderr.lines().rev() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        let t = t.strip_prefix("ERROR:").unwrap_or(t).trim();
        if !t.is_empty() {
            return t.chars().take(300).collect();
        }
    }
    "yt-dlp failed to read this link".into()
}
