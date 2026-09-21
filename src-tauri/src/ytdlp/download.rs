use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};

use super::{CANCELLED_EVENT, FAILED_EVENT, FINISHED_EVENT, PROGRESS_EVENT};
use crate::error::Result;
use crate::models::{
    DownloadRequest, DownloadStarted, FailedPayload, FinishedPayload, ProgressPayload,
};

struct Active {
    pid: u32,
    cancelled: Arc<AtomicBool>,
}

#[derive(Default)]
pub struct DownloadManager {
    inner: Mutex<HashMap<String, Active>>,
}

impl DownloadManager {
    pub fn default_arc() -> Arc<Self> {
        Arc::new(Self::default())
    }
    pub async fn start(
        self: &Arc<Self>,
        app: AppHandle,
        req: DownloadRequest,
    ) -> Result<DownloadStarted> {
        let (ytdlp, ffdir) = super::binary::ensure_all(&app).await?;
        std::fs::create_dir_all(&req.save_dir)?;

        let args = build_args(&req, ffdir.as_deref());
        let child = tokio::process::Command::new(&ytdlp)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()?;

        let id = uuid::Uuid::new_v4().to_string();
        let cancelled = Arc::new(AtomicBool::new(false));
        self.inner.lock().unwrap().insert(
            id.clone(),
            Active {
                pid: child.id().unwrap_or(0),
                cancelled: cancelled.clone(),
            },
        );

        let mgr = self.clone();
        tokio::spawn(watch(app, req, child, id.clone(), cancelled, mgr));

        Ok(DownloadStarted { id })
    }

    pub fn cancel(&self, id: &str) -> bool {
        let entry = self.inner.lock().unwrap().remove(id);
        match entry {
            Some(a) => {
                a.cancelled.store(true, Ordering::Relaxed);
                kill_tree(a.pid);
                true
            }
            None => false,
        }
    }

    fn done(&self, id: &str) {
        self.inner.lock().unwrap().remove(id);
    }
}

fn kill_tree(pid: u32) {
    if pid == 0 {
        return;
    }
    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .status();
    #[cfg(not(windows))]
    let _ = std::process::Command::new("kill")
        .args(["-9", &pid.to_string()])
        .status();
}

fn out_template(save_dir: &str) -> String {
    std::path::Path::new(save_dir)
        .join("%(title).180B [%(id)s].%(ext)s")
        .to_string_lossy()
        .into_owned()
}

fn build_args(req: &DownloadRequest, ffdir: Option<&std::path::Path>) -> Vec<String> {
    let mut a = vec![
        "--no-playlist".to_string(),
        "--newline".to_string(),
        "--no-warnings".to_string(),
        "--print".to_string(),
        "after_move:filepath".to_string(),
        "-o".to_string(),
        out_template(&req.save_dir),
    ];
    match req.format.as_str() {
        "4k" => {
            a.push("-f".into());
            a.push("bestvideo[height<=2160]+bestaudio/best[height<=2160]".into());
            a.push("--merge-output-format".into());
            a.push("mp4".into());
        }
        "1080" => {
            a.push("-f".into());
            a.push("bestvideo[height<=1080]+bestaudio/best[height<=1080]".into());
            a.push("--merge-output-format".into());
            a.push("mp4".into());
        }
        "mp3" => {
            a.push("-x".into());
            a.push("--audio-format".into());
            a.push("mp3".into());
            a.push("--audio-quality".into());
            a.push("320K".into());
            a.push("-f".into());
            a.push("bestaudio/best".into());
        }
        custom => {
            a.push("-f".into());
            a.push(custom.into());
            if custom.contains('+') {
                a.push("--merge-output-format".into());
                a.push(req.merge_ext.clone().unwrap_or_else(|| "mp4".into()));
            }
        }
    }
    if let Some(p) = req.proxy.as_deref().map(str::trim).filter(|p| !p.is_empty()) {
        a.push("--proxy".into());
        a.push(p.into());
    }
    if let Some(d) = ffdir {
        a.push("--ffmpeg-location".into());
        a.push(d.to_string_lossy().into_owned());
    }
    #[cfg(windows)]
    a.push("--windows-filenames".into());
    a.push(req.url.clone());
    a
}

fn is_stage_line(t: &str) -> bool {
    t.starts_with("[ExtractAudio]")
        || t.starts_with("[Merger]")
        || t.starts_with("[VideoConvertor]")
        || t.starts_with("[Fixup")
        || t.starts_with("[ffmpeg]")
        || t.starts_with("[Embed")
}

fn parse_speed(s: &str) -> Option<u64> {
    let (n, unit) = s.split_at(s.find(|c: char| c.is_alphabetic()).unwrap_or(s.len()));
    let n: f64 = n.trim().parse().ok()?;
    let mult = match unit {
        "B/s" => 1.0,
        "KiB/s" => 1024.0,
        "MiB/s" => 1024.0 * 1024.0,
        "GiB/s" => 1024.0 * 1024.0 * 1024.0,
        _ => return None,
    };
    Some((n * mult) as u64)
}

fn parse_eta(s: &str) -> Option<u64> {
    let mut secs = 0u64;
    for part in s.split(':') {
        secs = secs * 60 + part.parse::<u64>().ok()?;
    }
    Some(secs)
}

fn parse_progress(line: &str) -> Option<(f64, Option<u64>, Option<u64>)> {
    let rest = line.strip_prefix("[download]")?.trim();
    let mut toks = rest.split_whitespace();
    let pct = toks.next()?;
    if !pct.ends_with('%') {
        return None;
    }
    let pct: f64 = pct.trim_end_matches('%').parse().ok()?;
    if !(0.0..=100.0).contains(&pct) {
        return None;
    }
    let words: Vec<&str> = rest.split_whitespace().collect();
    let mut speed = None;
    let mut eta = None;
    let mut i = 0;
    while i < words.len() {
        match words[i] {
            "at" if i + 1 < words.len() && words[i + 1] != "Unknown" => {
                speed = parse_speed(words[i + 1]);
                i += 2;
            }
            "ETA" if i + 1 < words.len() => {
                eta = parse_eta(words[i + 1]);
                i += 2;
            }
            _ => i += 1,
        }
    }
    Some((pct, speed, eta))
}

fn last_error(buf: &str) -> String {
    for line in buf.lines().rev() {
        let t = line.trim();
        if t.is_empty() || t.starts_with("WARNING:") {
            continue;
        }
        let t = t.strip_prefix("ERROR:").unwrap_or(t).trim();
        if !t.is_empty() {
            return t.chars().take(300).collect();
        }
    }
    "download failed".into()
}

fn notify(title: &str, body: &str) {
    let _ = notify_rust::Notification::new()
        .summary(title)
        .body(body)
        .show();
}

async fn watch(
    app: AppHandle,
    req: DownloadRequest,
    mut child: tokio::process::Child,
    id: String,
    cancelled: Arc<AtomicBool>,
    mgr: Arc<DownloadManager>,
) {
    let stdout = child.stdout.take().expect("piped stdout");
    let stderr = child.stderr.take().expect("piped stderr");

    let err_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let err_sink = err_buf.clone();
    let err_task = tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let mut b = err_sink.lock().unwrap();
            b.push_str(&line);
            b.push('\n');
            let len = b.len();
            if len > 24_000 {
                b.drain(..len - 24_000);
            }
        }
    });

    let mut last_pct = 0.0;
    let mut last_path: Option<String> = None;

    let mut lines = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if t.starts_with('[') {
            if is_stage_line(t) {
                let _ = app.emit(
                    PROGRESS_EVENT,
                    ProgressPayload {
                        id: id.clone(),
                        percent: last_pct,
                        speed: None,
                        eta: None,
                        stage: "processing".into(),
                    },
                );
            } else if let Some((pct, speed, eta)) = parse_progress(t) {
                last_pct = pct;
                let _ = app.emit(
                    PROGRESS_EVENT,
                    ProgressPayload {
                        id: id.clone(),
                        percent: pct,
                        speed,
                        eta,
                        stage: "downloading".into(),
                    },
                );
            }
        } else {
            last_path = Some(t.to_string());
        }
    }

    let status = child.wait().await;
    let _ = err_task.await;
    mgr.done(&id);

    if cancelled.load(Ordering::Relaxed) {
        let _ = app.emit(CANCELLED_EVENT, serde_json::json!({ "id": id }));
        return;
    }

    if status.map(|s| s.success()).unwrap_or(false) {
        let path = last_path.clone().unwrap_or_default();
        let _ = app.emit(
            FINISHED_EVENT,
            FinishedPayload {
                id: id.clone(),
                path: path.clone(),
            },
        );
        let label = req.title.clone().unwrap_or_else(|| "Download finished".into());
        notify("OmniGrab", &label);
    } else {
        let msg = last_error(&err_buf.lock().unwrap());
        let _ = app.emit(
            FAILED_EVENT,
            FailedPayload {
                id: id.clone(),
                error: msg.clone(),
            },
        );
        notify("OmniGrab", &format!("Failed: {msg}"));
    }
}
