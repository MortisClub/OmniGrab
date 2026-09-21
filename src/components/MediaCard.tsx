import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Clock, Download, User } from "lucide-react";
import type { FormatInfo, MediaInfo, Preset } from "@/lib/types";
import { formatDuration, formatSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSettings } from "@/stores/settings";
import { Button } from "./ui/button";

function videos(fmts: FormatInfo[]) {
  return fmts.filter((f) => f.height != null && f.height > 0);
}

function audios(fmts: FormatInfo[]) {
  return fmts.filter(
    (f) => (f.height == null || f.height === 0) && f.acodec && f.acodec !== "none",
  );
}

function estimate(f: FormatInfo, duration: number | null): number | null {
  if (f.filesize) return f.filesize;
  if (f.tbr && duration) return Math.round((f.tbr * 1000 * duration) / 8);
  return null;
}

export function MediaCard({
  media,
  onDownload,
  busy,
}: {
  media: MediaInfo;
  onDownload: (preset: Preset, format: string, mergeExt: string | null) => void;
  busy: boolean;
}) {
  const lastPreset = useSettings((s) => s.lastPreset);
  const remember = useSettings((s) => s.setLastPreset);
  const initial: Preset =
    lastPreset === "4k" || lastPreset === "1080" || lastPreset === "mp3" || lastPreset === "custom"
      ? lastPreset
      : "1080";
  const [preset, setPreset] = useState<Preset>(initial);
  const [advanced, setAdvanced] = useState(false);
  const [vid, setVid] = useState("");
  const [aud, setAud] = useState("");

  const vids = useMemo(() => videos(media.formats), [media]);
  const auds = useMemo(() => audios(media.formats), [media]);

  const has4k = vids.some((f) => (f.height ?? 0) >= 2000);
  const has1080 = vids.some((f) => (f.height ?? 0) >= 700);
  const hasAudio = auds.length > 0 || media.formats.length > 0;

  const sizeHint = useMemo(() => {
    if (preset === "mp3") {
      const a = auds[0];
      return a ? formatSize(estimate(a, media.duration)) : null;
    }
    const cap = preset === "4k" ? 2160 : 1080;
    const v = vids.find((f) => (f.height ?? 0) <= cap) ?? vids[0];
    const a = auds[0];
    const total =
      (v ? estimate(v, media.duration) ?? 0 : 0) + (a ? estimate(a, media.duration) ?? 0 : 0);
    return total > 0 ? formatSize(total) : null;
  }, [preset, vids, auds, media.duration]);

  const pick = () => {
    if (preset === "custom") {
      const sel = [vid, aud].filter(Boolean).join("+");
      onDownload("custom", sel || "bestvideo+bestaudio/best", "mp4");
      return;
    }
    onDownload(preset, preset, preset === "mp3" ? null : "mp4");
  };

  useEffect(() => {
    remember(preset);
  }, [preset, remember]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!busy) pick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, vid, aud, busy]);

  const pill = (id: Preset, label: string, hint: string, enabled: boolean) => (
    <button
      key={id}
      disabled={!enabled}
      onClick={() => setPreset(id)}
      className={cn(
        "btn-press rounded-xl border px-3.5 py-2 text-left transition-colors",
        preset === id
          ? "border-[#6366F1] bg-[#6366F1]/15 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
          : "border-border bg-card hover:brightness-110",
        !enabled && "cursor-not-allowed opacity-40 hover:brightness-100",
      )}
    >
      <div className={cn("text-[13px] font-semibold", preset === id ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </div>
      <div className="text-[11px] text-muted-foreground">{enabled ? hint : "n/a"}</div>
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex flex-col gap-3.5 min-[560px]:flex-row">
        {media.thumbnail && (
          <img
            src={media.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            draggable={false}
            className="h-40 w-full shrink-0 rounded-xl border border-border object-cover min-[560px]:h-[86px] min-[560px]:w-[136px]"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-semibold text-foreground" title={media.title}>
            {media.title}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {media.uploader && (
              <span className="inline-flex items-center gap-1">
                <User size={12} /> {media.uploader}
              </span>
            )}
            {media.duration != null && (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {formatDuration(media.duration)}
              </span>
            )}
            {sizeHint && <span className="text-muted-foreground">~{sizeHint}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {pill("4k", "4K Ultra", "max quality", has4k || vids.length > 0)}
            {pill("1080", "1080p Full HD", "balanced", has1080 || vids.length > 0)}
            {pill("mp3", "MP3 Audio", "320 kbps", hasAudio)}
            <button
              onClick={() => {
                setAdvanced(!advanced);
                if (!advanced) setPreset("custom");
              }}
              className={cn(
                "btn-press inline-flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-[13px] text-muted-foreground hover:brightness-110",
                preset === "custom" && "border-[#6366F1] text-foreground",
              )}
            >
              More <ChevronDown size={14} className={cn(advanced && "rotate-180")} />
            </button>
          </div>
        </div>
      </div>

      {advanced && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Video stream</span>
            <select
              value={vid}
              onChange={(e) => setVid(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-[13px] text-foreground focus:border-[#6366F1] focus:outline-none"
            >
              <option value="">auto</option>
              {vids.slice(0, 30).map((f) => (
                <option key={f.formatId} value={f.formatId} className="bg-popover">
                  {f.height}p{f.fps ? Math.round(f.fps) : ""} · {f.ext}
                  {f.filesize ? ` · ${formatSize(f.filesize)}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">Audio stream</span>
            <select
              value={aud}
              onChange={(e) => setAud(e.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-[13px] text-foreground focus:border-[#6366F1] focus:outline-none"
            >
              <option value="">auto</option>
              {auds.slice(0, 30).map((f) => (
                <option key={f.formatId} value={f.formatId} className="bg-popover">
                  {f.acodec} · {f.ext}
                  {f.tbr ? ` · ${Math.round(f.tbr)}k` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <Button onClick={pick} disabled={busy} className="mt-3.5 h-11 w-full text-[14px]">
        <Download size={16} />
        {busy ? "Starting..." : "Download"}
      </Button>
    </motion.div>
  );
}
