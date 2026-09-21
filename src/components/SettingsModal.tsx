import { open as openDir } from "@tauri-apps/plugin-dialog";
import { FolderOpen, Loader2, Moon, RefreshCw, Sun } from "lucide-react";
import { api } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();

  const pickDir = async () => {
    const dir = await openDir({ directory: true, multiple: false });
    if (typeof dir === "string") s.setSaveDir(dir);
  };

  return (
    <Dialog open={open} onClose={onClose} title="Settings" wide>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
            Save folder
          </label>
          <div className="flex items-center gap-2">
            <Input value={s.saveDir ?? ""} readOnly placeholder="Choose a folder..." />
            <Button variant="secondary" onClick={pickDir} className="shrink-0">
              <FolderOpen size={15} /> Browse
            </Button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
            Proxy (optional)
          </label>
          <Input
            value={s.proxy}
            onChange={(e) => s.setProxy(e.target.value)}
            placeholder="http://127.0.0.1:1080"
            spellCheck={false}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-[12px] font-medium text-muted-foreground">
            Browser cookies (for age-restricted videos)
          </label>
          <select
            value={s.cookiesBrowser}
            onChange={(e) => s.setCookiesBrowser(e.target.value)}
            className="h-10 w-full rounded-xl border border-input bg-transparent px-2 text-sm text-foreground focus:border-[#6366F1] focus:outline-none"
          >
            <option value="" className="bg-popover">Disabled</option>
            {["chrome", "brave", "edge", "firefox", "opera", "vivaldi", "chromium", "safari"].map((b) => (
              <option key={b} value={b} className="bg-popover">
                {b[0].toUpperCase() + b.slice(1)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Reads cookies from the browser so private videos can load. Close the browser first or the read may fail.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <span className="inline-flex items-center gap-2 text-sm text-foreground">
            {s.theme === "light" ? <Sun size={15} /> : <Moon size={15} />}
            {s.theme === "light" ? "Light theme" : "Dark theme"}
          </span>
          <Switch
            checked={s.theme === "light"}
            onChange={(v) => s.setTheme(v ? "light" : "dark")}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <div>
            <div className="text-sm text-foreground">yt-dlp {s.ytdlpVersion ?? "…"}</div>
            <div className="text-[12px] text-muted-foreground">
              Keep the downloader engine fresh
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled={s.updating} onClick={() => s.updateNow().catch(() => {})}>
            {s.updating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {s.updating ? "Updating" : "Update now"}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground">Auto-update yt-dlp on launch</span>
          <Switch checked={s.autoUpdate} onChange={s.setAutoUpdate} />
        </div>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => s.saveDir && api.openFileLocation(s.saveDir).catch(() => {})}
        >
          <FolderOpen size={15} /> Open save folder
        </Button>
      </div>
    </Dialog>
  );
}
