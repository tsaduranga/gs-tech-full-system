"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import {
  SearchableNumPicker,
  type NumOption,
} from "@/components/searchable-num-picker";
import { cn } from "@/lib/utils";

const underlineInputClass = cn(
  "h-10 w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-sm shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
);

type ItemRow = {
  id: number;
  sku: string;
  name: string;
};

type WarehouseRow = {
  id: number;
  code: string;
  name: string;
};

export default function TransferItemsPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [itemId, setItemId] = useState(0);
  const [fromW, setFromW] = useState(0);
  const [toW, setToW] = useState(0);
  const [qty, setQty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [itemOptions, setItemOptions] = useState<NumOption[]>([]);
  const [warehouseOptions, setWarehouseOptions] = useState<NumOption[]>([]);

  const loadData = useCallback(async () => {
    setItemsLoading(true);
    setWarehousesLoading(true);
    const [itemsRes, whRes] = await Promise.all([
      apiJson<{ items: ItemRow[] }>("/items?page=1&pageSize=500"),
      apiJson<{ items: WarehouseRow[] }>("/warehouses?page=1&pageSize=500"),
    ]);
    if (itemsRes.ok && Array.isArray(itemsRes.data?.items)) {
      setItemOptions(
        itemsRes.data.items.map((i) => ({
          value: i.id,
          label: `${i.sku} — ${i.name}`,
        }))
      );
    } else setItemOptions([]);
    if (whRes.ok && Array.isArray(whRes.data?.items)) {
      setWarehouseOptions(
        whRes.data.items.map((w) => ({
          value: w.id,
          label: `${w.code} — ${w.name}`,
        }))
      );
    } else setWarehouseOptions([]);
    setItemsLoading(false);
    setWarehousesLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const toWarehouseOptions = useMemo(
    () =>
      fromW > 0
        ? warehouseOptions.filter((w) => w.value !== fromW)
        : warehouseOptions,
    [warehouseOptions, fromW]
  );

  async function transfer(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (itemId < 1 || fromW < 1 || toW < 1) {
      setErr("Select an item and both warehouses.");
      return;
    }
    if (fromW === toW) {
      setErr("Source and destination warehouses must be different.");
      return;
    }
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) {
      setErr("Enter a quantity greater than zero.");
      return;
    }
    setSubmitting(true);
    const res = await apiJson("/stock/transfer", {
      method: "POST",
      body: JSON.stringify({
        item_id: itemId,
        from_warehouse_id: fromW,
        to_warehouse_id: toW,
        quantity: q,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setErr(res.error ?? "Transfer failed");
      return;
    }
    setMsg("Transfer completed");
    setItemId(0);
    setFromW(0);
    setToW(0);
    setQty("");
  }

  return (
    <Card className="w-full max-w-6xl border-border/80">
      <CardHeader>
        <CardTitle>Transfer between warehouses</CardTitle>
        <p className="text-sm text-muted-foreground">
          Search by SKU, name, or warehouse code. Quantity uses a numeric field
          below.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={transfer} className="flex flex-col gap-8">
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="tf-item">Item</Label>
              <SearchableNumPicker
                id="tf-item"
                options={itemOptions}
                valueId={itemId}
                onValueChange={setItemId}
                placeholder="Search SKU or name…"
                loading={itemsLoading}
                emptyListHint="No items"
                emptyFilterHint="No matching items"
                variant="underline"
              />
            </div>
            <div className="min-w-0 space-y-2">
              <Label htmlFor="tf-from">From warehouse</Label>
              <SearchableNumPicker
                id="tf-from"
                options={warehouseOptions}
                valueId={fromW}
                onValueChange={(id) => {
                  setFromW(id);
                  if (id < 1) setToW(0);
                  else setToW((t) => (t === id ? 0 : t));
                }}
                placeholder="Search warehouse…"
                loading={warehousesLoading}
                emptyListHint="No warehouses"
                emptyFilterHint="No matching warehouses"
                variant="underline"
              />
            </div>
            <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
              <Label htmlFor="tf-to">To warehouse</Label>
              <SearchableNumPicker
                id="tf-to"
                options={toWarehouseOptions}
                valueId={toW}
                onValueChange={setToW}
                placeholder={
                  fromW < 1
                    ? "Pick source warehouse first"
                    : "Search warehouse…"
                }
                disabled={fromW < 1}
                loading={warehousesLoading}
                emptyListHint={
                  fromW < 1
                    ? "Pick source warehouse first"
                    : "No other warehouses"
                }
                emptyFilterHint="No matching warehouses"
                variant="underline"
              />
            </div>
          </div>

          <div className="grid max-w-md gap-2">
            <Label htmlFor="tf-qty">Quantity</Label>
            <Input
              id="tf-qty"
              type="number"
              step="any"
              min={0}
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={underlineInputClass}
            />
          </div>

          <div className="flex max-w-xl flex-col gap-2 pt-2">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? "Transferring…" : "Transfer"}
            </Button>
            {msg ? (
              <p className="text-sm text-muted-foreground" role="status">
                {msg}
              </p>
            ) : null}
            {err ? (
              <p className="text-sm text-destructive" role="alert">
                {err}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
