import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Settings2, Square, X } from "lucide-react";

export function TitleBar({ onSettings }: { onSettings: () => void }) {
  const win = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3"
    >
      <div className="flex items-center gap-1.5 pl-1" data-tauri-drag-region>
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      <div
        data-tauri-drag-region
        className="flex flex-1 items-center justify-center gap-2"
      >
        <img src="/icon.png" alt="" className="h-5 w-5 rounded" draggable={false} />
        <span className="bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] bg-clip-text text-[13px] font-bold text-transparent">
          OmniGrab
        </span>
      </div>

      <button
        onClick={onSettings}
        className="btn-press rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        title="Settings"
      >
        <Settings2 size={16} />
      </button>
      <div className="flex items-center">
        <button
          onClick={() => win.minimize()}
          className="btn-press rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Minus size={16} />
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          className="btn-press rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <Square size={13} />
        </button>
        <button
          onClick={() => win.close()}
          className="btn-press rounded-md p-1.5 text-muted-foreground hover:bg-red-500/20 hover:text-red-400"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
