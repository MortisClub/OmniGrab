import { ClipboardPaste, Link2, Loader2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { isUrl } from "@/lib/format";

export function URLInput({
  value,
  onChange,
  fetching,
  onPaste,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  fetching: boolean;
  onPaste: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Link2
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "v" && (e.ctrlKey || e.metaKey) && !isUrl(value)) onPaste();
          }}
          placeholder="Paste a video or playlist link..."
          spellCheck={false}
          className="h-11 bg-card pl-10 pr-10 text-[14px]"
        />
        {fetching ? (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[#6366F1]"
          />
        ) : (
          value && (
            <button
              onClick={onClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          )
        )}
      </div>
      <Button onClick={onPaste} variant="secondary" className="h-11 px-4">
        <ClipboardPaste size={16} />
        Paste
      </Button>
    </div>
  );
}
