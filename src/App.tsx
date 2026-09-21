import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { AnimatePresence } from "framer-motion";
import { AlertCircle, FolderOpen } from "lucide-react";
import { api } from "@/lib/ipc";
import { isUrl } from "@/lib/format";
import { version as appVersion } from "../package.json";
import type {
  DownloadItem,
  FailedPayload,
  FinishedPayload,
  MediaInfo,
  Preset,
  ProgressPayload,
} from "@/lib/types";
import { useDownloads } from "@/stores/downloads";
import { useSettings } from "@/stores/settings";
import { BrandIcon, type Brand } from "@/components/BrandIcon";
import { DownloadQueue } from "@/components/DownloadQueue";
import { MediaCard } from "@/components/MediaCard";
import { SettingsModal } from "@/components/SettingsModal";
import { TitleBar } from "@/components/TitleBar";
import { URLInput } from "@/components/URLInput";

const BRANDS: Brand[] = ["youtube", "tiktok", "instagram", "vk", "x", "twitch", "soundcloud"];

export default function App() {
  const [url, setUrl] = useState("");
  const [media, setMedia] = useState<MediaInfo | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const items = useDownloads((s) => s.items);
  const settings = useSettings();
  const lastFetched = useRef("");

  useEffect(() => {
    settings.init();
  }, []);

  useEffect(() => {
    const offs: (() => void)[] = [];
    listen<ProgressPayload>("download-progress", (e) => {
      const p = e.payload;
      useDownloads.getState().patchByRemoteId(p.id, {
        status: p.stage === "processing" ? "processing" : "downloading",
        percent: p.percent,
        speed: p.speed,
        eta: p.eta,
      });
    }).then((f) => offs.push(f));
    listen<FinishedPayload>("download-finished", (e) => {
      useDownloads.getState().patchByRemoteId(e.payload.id, {
        status: "done",
        percent: 100,
        speed: null,
        eta: null,
        outPath: e.payload.path,
      });
    }).then((f) => offs.push(f));
    listen<FailedPayload>("download-failed", (e) => {
      useDownloads.getState().patchByRemoteId(e.payload.id, {
        status: "error",
        error: e.payload.error,
      });
    }).then((f) => offs.push(f));
    listen<{ id: string }>("download-cancelled", (e) => {
      useDownloads.getState().patchByRemoteId(e.payload.id, { status: "cancelled" });
    }).then((f) => offs.push(f));
    return () => offs.forEach((f) => f());
  }, []);

  const fetchMeta = useCallback(
    async (link: string) => {
      const clean = link.trim();
      if (!isUrl(clean) || clean === lastFetched.current) return;
      lastFetched.current = clean;
      setFetching(true);
      setFetchError(null);
      try {
        const info = await api.fetchMetadata(clean, settings.proxy || null);
        setMedia(info);
      } catch (e) {
        setMedia(null);
        setFetchError(typeof e === "string" ? e : "Could not read this link");
      } finally {
        setFetching(false);
      }
    },
    [settings.proxy],
  );

  useEffect(() => {
    if (!isUrl(url)) {
      setMedia(null);
      setFetchError(null);
      lastFetched.current = "";
      return;
    }
    const t = setTimeout(() => fetchMeta(url), 600);
    return () => clearTimeout(t);
  }, [url, fetchMeta]);

  const paste = useCallback(async () => {
    try {
      const t = await readText();
      if (t && isUrl(t)) {
        setUrl(t.trim());
        fetchMeta(t.trim());
      }
    } catch {
      /* clipboard denied */
    }
  }, [fetchMeta]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused && !url) paste();
      })
      .then((f) => (unlisten = f))
      .catch(() => {});
    return () => unlisten?.();
  }, [url, paste]);

  const startDownload = async (preset: Preset, format: string, mergeExt: string | null) => {
    const saveDir = settings.saveDir;
    if (!saveDir) {
      setSettingsOpen(true);
      return;
    }
    setStarting(true);
    const localId = `local-${Date.now()}`;
    const base: DownloadItem = {
      id: localId,
      url,
      title: media?.title ?? url,
      preset: preset === "custom" ? format : preset,
      saveDir,
      status: "queued",
      percent: 0,
      speed: null,
      eta: null,
      outPath: null,
      error: null,
      createdAt: Date.now(),
    };
    useDownloads.getState().upsert(base);
    try {
      const started = await api.startDownload({
        url,
        format,
        mergeExt,
        proxy: settings.proxy || null,
        title: media?.title ?? null,
        saveDir,
      });
      useDownloads.getState().remove(localId);
      useDownloads.getState().upsert({ ...base, id: started.id });
    } catch (e) {
      useDownloads.getState().patch(localId, {
        status: "error",
        error: typeof e === "string" ? e : "Failed to start",
      });
    } finally {
      setStarting(false);
    }
  };

  const retry = async (item: DownloadItem) => {
    const saveDir = settings.saveDir ?? item.saveDir;
    const localId = `local-${Date.now()}`;
    useDownloads.getState().upsert({
      ...item,
      id: localId,
      status: "queued",
      percent: 0,
      error: null,
      outPath: null,
    });
    try {
      const started = await api.startDownload({
        url: item.url,
        format: item.preset,
        mergeExt: "mp4",
        proxy: settings.proxy || null,
        title: item.title,
        saveDir,
      });
      useDownloads.getState().remove(localId);
      useDownloads.getState().upsert({ ...item, id: started.id, status: "queued", percent: 0, error: null });
    } catch (e) {
      useDownloads.getState().patch(localId, {
        status: "error",
        error: typeof e === "string" ? e : "Failed to start",
      });
    }
  };

  const doneCount = items.filter((d) => d.status === "done").length;

  return (
    <div className="app-shell flex h-full flex-col overflow-hidden rounded-xl border border-border">
      <TitleBar onSettings={() => setSettingsOpen(true)} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <URLInput
          value={url}
          onChange={setUrl}
          fetching={fetching}
          onPaste={paste}
          onClear={() => {
            setUrl("");
            setMedia(null);
          }}
        />

        {fetchError && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-[13px] text-red-300">
            <AlertCircle size={15} className="shrink-0" />
            {fetchError}
          </div>
        )}

        <AnimatePresence mode="wait">
          {media && (
            <MediaCard key={media.id} media={media} onDownload={startDownload} busy={starting} />
          )}
        </AnimatePresence>

        <DownloadQueue
          items={items}
          onRetry={retry}
          onRemove={(id) => useDownloads.getState().remove(id)}
          onClearFinished={() => useDownloads.getState().clearFinished()}
        />

        {items.length > 0 && (
          <div className="flex items-center justify-center gap-4 pb-1 pt-2">
            {BRANDS.map((b) => (
              <BrandIcon key={b} brand={b} size={22} />
            ))}
          </div>
        )}
      </div>

      <div className="flex h-9 shrink-0 items-center gap-2 border-t border-border px-3 text-[12px] text-muted-foreground">
        <button
          onClick={() => settings.saveDir && api.openFileLocation(settings.saveDir).catch(() => {})}
          className="btn-press inline-flex min-w-0 items-center gap-1.5 hover:text-foreground"
          title="Open save folder"
        >
          <FolderOpen size={13} className="shrink-0" />
          <span className="truncate">{settings.saveDir ?? "…"}</span>
        </button>
        <span className="ml-auto shrink-0 tabular-nums">Downloads: {doneCount}</span>
        <span className="shrink-0 tabular-nums">v{appVersion}</span>
      </div>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
