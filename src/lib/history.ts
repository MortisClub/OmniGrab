import type { DownloadItem, DownloadStatus } from "./types";

const KEY = "omnigrab-history";
const MAX = 50;

const TERMINAL: DownloadStatus[] = ["done", "error", "cancelled"];

export function loadHistory(): DownloadItem[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (d): d is DownloadItem =>
        d && typeof d.id === "string" && TERMINAL.includes(d.status),
    );
  } catch {
    return [];
  }
}

export function saveHistory(items: DownloadItem[]) {
  try {
    const terminal = items.filter((d) => TERMINAL.includes(d.status)).slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(terminal));
  } catch {
    /* storage full or unavailable */
  }
}
