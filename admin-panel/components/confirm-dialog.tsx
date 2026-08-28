"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmDialogOptions = {
  title?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(
    null
  );

  const confirm = useCallback((opts: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts);
      setResolver(() => resolve);
      setOpen(true);
    });
  }, []);

  function finish(confirmed: boolean) {
    setOpen(false);
    resolver?.(confirmed);
    setResolver(null);
    setOptions(null);
  }

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish(false);
      }}
    >
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{options?.title ?? "Confirm"}</DialogTitle>
        </DialogHeader>
        <p className="px-4 py-4 text-sm text-muted-foreground">
          {options?.description}
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => finish(false)}
          >
            {options?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={options?.destructive ? "destructive" : "default"}
            onClick={() => finish(true)}
          >
            {options?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
