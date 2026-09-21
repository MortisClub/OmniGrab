import { invoke } from "@tauri-apps/api/core";
import type { BinariesInfo, DownloadRequest, MediaInfo } from "./types";

interface Started {
  id: string;
}

export const api = {
  fetchMetadata: (url: string, proxy: string | null) =>
    invoke<MediaInfo>("fetch_metadata", { url, proxy }),
  startDownload: (request: DownloadRequest) =>
    invoke<Started>("start_download", { request }),
  cancelDownload: (id: string) => invoke<boolean>("cancel_download", { id }),
  openFileLocation: (path: string) =>
    invoke<void>("open_file_location", { path }),
  defaultSaveDir: () => invoke<string | null>("default_save_dir"),
  ytdlpVersion: () => invoke<string | null>("ytdlp_version"),
  updateBinaries: () => invoke<BinariesInfo>("update_binaries"),
};
