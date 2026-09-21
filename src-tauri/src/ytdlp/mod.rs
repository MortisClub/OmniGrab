pub mod binary;
pub mod download;
pub mod metadata;

pub const PROGRESS_EVENT: &str = "download-progress";
pub const FINISHED_EVENT: &str = "download-finished";
pub const FAILED_EVENT: &str = "download-failed";
pub const CANCELLED_EVENT: &str = "download-cancelled";

pub fn ytdlp_name() -> &'static str {
    if cfg!(windows) {
        "yt-dlp.exe"
    } else {
        "yt-dlp"
    }
}

pub fn ffmpeg_name() -> &'static str {
    if cfg!(windows) {
        "ffmpeg.exe"
    } else {
        "ffmpeg"
    }
}

pub fn ffprobe_name() -> &'static str {
    if cfg!(windows) {
        "ffprobe.exe"
    } else {
        "ffprobe"
    }
}
