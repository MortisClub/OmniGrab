export interface FormatInfo {
  formatId: string;
  ext: string;
  height: number | null;
  width: number | null;
  fps: number | null;
  vcodec: string | null;
  acodec: string | null;
  tbr: number | null;
  filesize: number | null;
  protocol: string | null;
}

export interface MediaInfo {
  id: string;
  title: string;
  uploader: string | null;
  duration: number | null;
  thumbnail: string | null;
  webpageUrl: string;
  formats: FormatInfo[];
}

export type Preset = "4k" | "1080" | "mp3" | "custom";

export interface DownloadRequest {
  url: string;
  format: string;
  mergeExt: string | null;
  proxy: string | null;
  title: string | null;
  saveDir: string;
}

export type DownloadStatus =
  | "queued"
  | "downloading"
  | "processing"
  | "done"
  | "error"
  | "cancelled";

export interface DownloadItem {
  id: string;
  url: string;
  title: string;
  preset: string;
  saveDir: string;
  status: DownloadStatus;
  percent: number;
  speed: number | null;
  eta: number | null;
  outPath: string | null;
  error: string | null;
  createdAt: number;
}

export interface ProgressPayload {
  id: string;
  percent: number;
  speed: number | null;
  eta: number | null;
  stage: string;
}

export interface FinishedPayload {
  id: string;
  path: string;
}

export interface FailedPayload {
  id: string;
  error: string;
}

export interface BinariesInfo {
  ytdlpVersion: string | null;
  ffmpegReady: boolean;
}
