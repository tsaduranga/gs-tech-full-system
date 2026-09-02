import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function DashboardFooterBar({
  left,
  right,
  className,
}: {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0 text-xs text-muted-foreground">{left}</div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}

export function DefaultDashboardFooter() {
  return (
    <DashboardFooterBar
      left={<span>GS Technology</span>}
      right={<span suppressHydrationWarning>{new Date().getFullYear()}</span>}
    />
  );
}
