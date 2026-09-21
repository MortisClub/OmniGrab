import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Download,
  FileAudio,
  FileVideo,
  FolderOpen,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/ipc";
import { formatBytes, formatEta } from "@/lib/format";
import type { DownloadItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

function statusBadge(s: DownloadItem["status"]) {
  switch (s) {
    case "downloading":
      return <Badge variant="accent">live</Badge>;
    case "processing":
      return <Badge variant="warning">converting</Badge>;
    case "done":
      return <Badge variant="success">done</Badge>;
    case "error":
      return <Badge variant="error">error</Badge>;
    case "cancelled":
      return <Badge>cancelled</Badge>;
    default:
      return <Badge>queued</Badge>;
  }
}

function Row({
  item,
  onRetry,
  onRemove,
}: {
  item: DownloadItem;
  onRetry: (item: DownloadItem) => void;
  onRemove: (id: string) => void;
}) {
  const live = item.status === "downloading" || item.status === "processing";
  const audio = item.preset === "mp3" || item.preset === "m4a";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="card-hover rounded-2xl border border-border bg-card p-3.5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          {item.status === "done" ? (
            <Check size={18} className="text-emerald-400" />
          ) : item.status === "error" ? (
            <AlertTriangle size={18} className="text-red-400" />
          ) : live ? (
            <Loader2 size={18} className="animate-spin text-[#a5b4fc]" />
          ) : audio ? (
            <FileAudio size={18} />
          ) : (
            <FileVideo size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-medium text-foreground" title={item.title}>
              {item.title}
            </p>
            {statusBadge(item.status)}
          </div>
          <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
            {item.preset === "mp3" ? "MP3 Audio" : item.preset === "4k" ? "4K Ultra" : item.preset === "1080" ? "1080p Full HD" : item.preset}
            {item.error ? ` · ${item.error}` : ""}
          </p>

          {(live || item.status === "queued") && (
            <div className="mt-2">
              <Progress value={item.percent} />
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="tabular-nums">{item.percent.toFixed(1)}%</span>
                <span className="tabular-nums">
                  {item.status === "processing"
                    ? "Merging..."
                    : `${formatBytes(item.speed)} · ETA ${formatEta(item.eta)}`}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {live && (
            <Button
              size="icon"
              variant="ghost"
              title="Cancel"
              onClick={() => api.cancelDownload(item.id).catch(() => {})}
            >
              <X size={15} />
            </Button>
          )}
          {item.status === "done" && item.outPath && (
            <Button
              size="icon"
              variant="ghost"
              title="Show in folder"
              onClick={() => api.openFileLocation(item.outPath!).catch(() => {})}
            >
              <FolderOpen size={15} />
            </Button>
          )}
          {(item.status === "error" || item.status === "cancelled") && (
            <Button size="icon" variant="ghost" title="Retry" onClick={() => onRetry(item)}>
              <RotateCcw size={15} />
            </Button>
          )}
          {!live && (
            <Button size="icon" variant="ghost" title="Remove" onClick={() => onRemove(item.id)}>
              <Trash2 size={15} />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function DownloadQueue({
  items,
  onRetry,
  onRemove,
  onClearFinished,
}: {
  items: DownloadItem[];
  onRetry: (item: DownloadItem) => void;
  onRemove: (id: string) => void;
  onClearFinished: () => void;
}) {
  const active = items.filter((d) => d.status === "queued" || d.status === "downloading" || d.status === "processing");
  const rest = items.filter((d) => !(d.status === "queued" || d.status === "downloading" || d.status === "processing"));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
        <Download size={64} strokeWidth={1.25} className="empty-pulse text-muted-foreground" opacity={0.3} />
        <p className="mt-4 text-[14px] font-medium text-foreground">
          Drag a link here or press Ctrl+V
        </p>
        <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
          Works with YouTube, TikTok, VK, Instagram and 1000+ more sites
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active downloads ({active.length})
        </h3>
        {rest.length > 0 && (
          <button
            onClick={onClearFinished}
            className="text-[12px] text-muted-foreground hover:text-foreground"
          >
            Clear finished
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {active.map((d) => (
          <Row key={d.id} item={d} onRetry={onRetry} onRemove={onRemove} />
        ))}
      </AnimatePresence>
      {rest.length > 0 && (
        <div className={cn("space-y-2", active.length > 0 && "pt-1")}>
          <AnimatePresence initial={false}>
            {rest.map((d) => (
              <Row key={d.id} item={d} onRetry={onRetry} onRemove={onRemove} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
