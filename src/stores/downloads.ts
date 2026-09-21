import { create } from "zustand";
import type { DownloadItem, DownloadStatus } from "@/lib/types";

interface DownloadsState {
  items: DownloadItem[];
  upsert: (item: DownloadItem) => void;
  patch: (id: string, patch: Partial<DownloadItem>) => void;
  patchByRemoteId: (remoteId: string, patch: Partial<DownloadItem>) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
}

const TERMINAL: DownloadStatus[] = ["done", "error", "cancelled"];

export const useDownloads = create<DownloadsState>((set) => ({
  items: [],

  upsert: (item) =>
    set((s) => {
      const i = s.items.findIndex((d) => d.id === item.id);
      if (i >= 0) {
        const next = [...s.items];
        next[i] = { ...next[i], ...item };
        return { items: next };
      }
      return { items: [item, ...s.items] };
    }),

  patch: (id, patch) =>
    set((s) => ({
      items: s.items.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),

  patchByRemoteId: (remoteId, patch) =>
    set((s) => ({
      items: s.items.map((d) => (d.id === remoteId ? { ...d, ...patch } : d)),
    })),

  remove: (id) => set((s) => ({ items: s.items.filter((d) => d.id !== id) })),

  clearFinished: () =>
    set((s) => ({ items: s.items.filter((d) => !TERMINAL.includes(d.status)) })),
}));
