"use client";

import { useCallback, useRef, useState } from "react";
import { EyeIcon, Loader2Icon } from "lucide-react";
import { apiJson } from "@/lib/api";

type WarehouseStock = {
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
  quantity: number;
};

type ItemStockResponse = {
  total: number;
  warehouses: WarehouseStock[];
};

const stockCache = new Map<number, ItemStockResponse>();

function isValidStockResponse(v: unknown): v is ItemStockResponse {
  return (
    typeof v === "object" &&
    v !== null &&
    "total" in v &&
    Array.isArray((v as ItemStockResponse).warehouses)
  );
}

export function ItemStockHoverInfo({ itemId }: { itemId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ItemStockResponse | null>(() => {
    const cached = stockCache.get(itemId);
    return cached && isValidStockResponse(cached) ? cached : null;
  });
  const [error, setError] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchStock = useCallback(async () => {
    const cached = stockCache.get(itemId);
    if (cached && isValidStockResponse(cached)) {
      setData(cached);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<ItemStockResponse>(`/stock/by-item/${itemId}`);
      if (!res.ok || !res.data) {
        throw new Error(res.error ?? "Failed to load stock");
      }
      stockCache.set(itemId, res.data);
      setData(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stock");
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  const handleEnter = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
    void fetchStock();
  };

  const handleLeave = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        aria-label="View stock levels"
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <EyeIcon className="h-4 w-4" />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-border bg-popover p-3 text-sm shadow-lg"
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <p className="font-medium text-foreground">Stock on hand</p>
          {loading && !data ? (
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              <Loader2Icon className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : error ? (
            <p className="mt-2 text-destructive">{error}</p>
          ) : data ? (
            <>
              <p className="mt-2 tabular-nums">
                <span className="text-muted-foreground">Total in store: </span>
                <span className="font-semibold">{data.total}</span>
              </p>
              {data.warehouses?.length ? (
                <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                  {data.warehouses.map((w) => (
                    <li
                      key={w.warehouse_id}
                      className="flex justify-between gap-2 tabular-nums"
                    >
                      <span className="truncate text-muted-foreground">
                        {w.warehouse_code}
                        {w.warehouse_name && w.warehouse_name !== w.warehouse_code
                          ? ` — ${w.warehouse_name}`
                          : ""}
                      </span>
                      <span className="font-medium">{w.quantity}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-muted-foreground">No stock recorded</p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
