"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export function AppLoadingScreen({
  fullScreen = true,
  message = "Loading your workspace…",
  className,
}: {
  fullScreen?: boolean;
  message?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center bg-background px-6",
        fullScreen ? "min-h-screen" : "min-h-[40vh] py-12",
        className
      )}
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <div className="relative flex flex-col items-center gap-5">
          <div className="rounded-2xl border border-border/80 bg-card px-6 py-5 shadow-sm">
            <Image
              src="/gs-technology-logo.png"
              alt="GS Technology"
              width={220}
              height={74}
              priority
              className="h-auto w-[200px] max-w-full object-contain sm:w-[220px]"
            />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold tracking-tight text-foreground">
              GS Technology
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>

        <div className="w-full max-w-[240px] space-y-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="app-loading-bar h-full w-2/5 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
          </div>
          <p className="text-center text-xs text-muted-foreground/80">
            Please wait
          </p>
        </div>
      </div>
    </div>
  );
}
