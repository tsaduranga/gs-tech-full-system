"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StrOption = { value: string; label: string };

/** Searchable combobox; empty `value` means no selection (unless `allowClear` is false). */
export function SearchableStrPicker({
  id,
  options,
  value,
  onValueChange,
  disabled,
  loading,
  placeholder,
  emptyFilterHint = "No matches",
  emptyListHint = "No options",
  invalid,
  allowClear = true,
}: {
  id: string;
  options: StrOption[];
  value: string;
  onValueChange: (next: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder: string;
  emptyFilterHint?: string;
  emptyListHint?: string;
  invalid?: boolean;
  allowClear?: boolean;
}) {
  const filter = Combobox.useFilter();

  const selected = React.useMemo(() => {
    if (!value || !value.trim()) return null;
    return options.find((x) => x.value === value) ?? null;
  }, [options, value]);

  if (loading) {
    return (
      <div
        id={id}
        role="status"
        className={cn(
          "flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground",
          invalid && "border-destructive"
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
          "flex h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground",
          invalid && "border-destructive"
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
          "flex h-10 w-full items-center rounded-md border border-dashed border-input bg-muted/30 px-3 text-sm text-muted-foreground",
          invalid && "border-destructive"
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
        const next = v as StrOption | null;
        onValueChange(next?.value ?? "");
      }}
      filter={filter.contains}
      isItemEqualToValue={(a, b) =>
        Boolean(
          a &&
            b &&
            (a as StrOption).value === (b as StrOption).value
        )
      }
    >
      <Combobox.InputGroup
        aria-invalid={invalid}
        className={cn(
          "flex h-10 w-full min-w-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 outline-none transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 disabled:opacity-60 dark:bg-input/30",
          invalid && "border-destructive focus-within:ring-destructive/20"
        )}
      >
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
        {allowClear ? (
          <Combobox.Clear
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Clear selection"
          />
        ) : null}
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
              {(item: StrOption) => (
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
