import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="btn-press inline-flex items-center gap-2.5"
    >
      <span
        className={cn(
          "relative rounded-full transition-colors",
          checked ? "bg-[#6366F1]" : "bg-secondary",
        )}
        style={{ height: 22, width: 40 }}
      >
        <span
          className="absolute top-[3px] h-[16px] w-[16px] rounded-full bg-white shadow transition-all"
          style={{ left: checked ? 21 : 3 }}
        />
      </span>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </button>
  );
}
