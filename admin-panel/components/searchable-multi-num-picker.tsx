"use client";

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type NumOption = { value: number; label: string };

export function SearchableMultiNumPicker({
  id,
  options,
  valueIds,
  onValueChange,
  disabled,
  loading,
  placeholder = "Search suppliers…",
  emptyListHint = "No suppliers available",
  invalid,
}: {
  id: string;
  options: NumOption[];
  valueIds: number[];
  onValueChange: (ids: number[]) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  emptyListHint?: string;
  invalid?: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const selectedSet = React.useMemo(() => new Set(valueIds), [valueIds]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const summary = React.useMemo(() => {
    if (valueIds.length === 0) return "None selected";
    const labels = valueIds
      .map((id) => options.find((o) => o.value === id)?.label)
      .filter(Boolean);
    if (labels.length <= 2) return labels.join(", ");
    return `${labels.slice(0, 2).join(", ")} +${labels.length - 2} more`;
  }, [valueIds, options]);

  function toggle(idVal: number, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) next.add(idVal);
    else next.delete(idVal);
    onValueChange([...next].sort((a, b) => a - b));
  }

  if (loading) {
    return (
      <div
        id={id}
        role="status"
        className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground"
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
        className="flex min-h-10 w-full items-center rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
      >
        {summary}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "rounded-md border border-input bg-background px-2 py-1.5 text-xs text-muted-foreground",
          invalid && "border-destructive"
        )}
      >
        {summary}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-md border border-input bg-background",
          invalid && "border-destructive"
        )}
      >
        <div className="border-b border-border px-2 py-1.5">
          <Label htmlFor={`${id}-search`} className="sr-only">
            Search options
          </Label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={`${id}-search`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-8 border-0 bg-transparent pl-8 shadow-none focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-40 space-y-0.5 overflow-y-auto p-2">
          {options.length === 0 ? (
            <p className="px-1 py-2 text-center text-xs text-muted-foreground">{emptyListHint}</p>
          ) : filtered.length === 0 ? (
            <p className="px-1 py-2 text-center text-xs text-muted-foreground">No matches</p>
          ) : (
            filtered.map((opt) => {
              const checked = selectedSet.has(opt.value);
              const inputId = `${id}-opt-${opt.value}`;
              return (
                <label
                  key={opt.value}
                  htmlFor={inputId}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox
                    id={inputId}
                    checked={checked}
                    onCheckedChange={(v) => toggle(opt.value, v === true)}
                  />
                  <span className="leading-snug">{opt.label}</span>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
