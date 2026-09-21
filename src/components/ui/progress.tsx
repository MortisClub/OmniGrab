import { cn } from "@/lib/utils";

export function Progress({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-[#334155]", className)}>
      <div
        className="progress-shimmer h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] transition-[width] duration-300"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
