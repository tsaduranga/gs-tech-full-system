"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NumOption = { value: number; label: string };

const shellMuted =
  "text-muted-foreground disabled:opacity-60 dark:bg-transparent";

/**
 * Single-select searchable combobox for numeric option values (`0` = none / cleared).
 */
export function SearchableNumPicker({
  id,
  options,
  valueId,
  onValueChange,
  disabled,
  loading,
  placeholder,
  emptyFilterHint = "No matches",
  emptyListHint = "No options",
  invalid,
  variant = "default",
}: {
  id: string;
  options: NumOption[];
  valueId: number;
  onValueChange: (id: number) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
  emptyFilterHint?: string;
  emptyListHint?: string;
  invalid?: boolean;
  /** `"underline"` = bottom border only (wider minimalist fields). */
  variant?: "default" | "underline";
}) {
  const filter = Combobox.useFilter();

  const isUnderline = variant === "underline";

  /** Bottom border row (minimal “underline” chrome). */
  const underlineChrome = cn(
    "rounded-none border-0 border-b bg-transparent px-1 shadow-none dark:bg-transparent",
    invalid ? "border-destructive" : "border-input"
  );
  const boxedChrome = cn(
    "rounded-md border border-input bg-background px-2.5 dark:bg-input/30",
    invalid && "border-destructive"
  );
  const fieldChrome = isUnderline ? underlineChrome : boxedChrome;

  const selected = React.useMemo(
    () => (valueId > 0 ? options.find((x) => x.value === valueId) ?? null : null),
    [options, valueId]
  );

  if (loading) {
    return (
      <div
        id={id}
        role="status"
        className={cn(
          "flex h-10 w-full items-center text-sm",
          isUnderline
            ? cn(underlineChrome, "border-muted-foreground/40", shellMuted)
            : cn(
                "rounded-md border border-input bg-muted/50 px-3 text-muted-foreground",
                invalid && "border-destructive"
              )
        )}
        aria-busy="true"
      >
        Loading…
      </div>
    );
  }

  if (disabled) {
    return (
      <div
        id={id}
        className={cn(
          "flex h-10 w-full items-center text-sm",
          isUnderline
            ? cn(underlineChrome, shellMuted)
            : cn(
                "rounded-md border border-input bg-muted/40 px-3 text-muted-foreground",
                invalid && "border-destructive"
              )
        )}
      >
        {selected?.label ?? placeholder}
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div
        id={id}
        role="note"
        className={cn(
          "flex h-10 w-full items-center text-sm",
          isUnderline
            ? cn(underlineChrome, "border-dashed text-muted-foreground")
            : cn(
                "rounded-md border border-dashed border-input bg-muted/30 px-3 text-muted-foreground",
                invalid && "border-destructive"
              )
        )}
      >
        {emptyListHint}
      </div>
    );
  }

  return (
    <Combobox.Root
      modal={false}
      items={options}
      value={selected}
      onValueChange={(v) => {
        const next = v as NumOption | null;
        onValueChange(next?.value ?? 0);
      }}
      filter={filter.contains}
      isItemEqualToValue={(a, b) =>
        Boolean(a && b && (a as NumOption).value === (b as NumOption).value)
      }
    >
      <Combobox.InputGroup
        aria-invalid={invalid}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-1 outline-none transition-[color,box-shadow] disabled:opacity-60",
          fieldChrome,
          isUnderline
            ? "focus-within:border-ring focus-within:ring-0"
            : cn(
                "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
                invalid && "focus-within:ring-destructive/20"
              )
        )}
      >
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        <Combobox.Clear
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Clear selection"
        />
        <Combobox.Trigger
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Open list"
        >
          <ChevronDownIcon className="size-4 opacity-70" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-[200] outline-none" sideOffset={4} align="start">
          <Combobox.Popup className="max-h-60 w-[var(--anchor-width)] origin-[var(--transform-origin)] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <Combobox.Empty className="px-2 py-2 text-center text-xs text-muted-foreground">
              {emptyFilterHint}
            </Combobox.Empty>
            <Combobox.List className="max-h-52 scroll-py-1 overflow-y-auto outline-none">
              {(item: NumOption) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="cursor-default select-none rounded-md px-2 py-1.5 text-sm outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-accent data-highlighted:text-accent-foreground"
                >
                  {item.label}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
