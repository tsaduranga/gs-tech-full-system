"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { SearchableNumPicker } from "@/components/searchable-num-picker";

type SupplierBrief = { id: number; name: string };

type ItemBrief = { id: number; sku: string; name: string };

type LineDraft = {
  key: string;
  itemId: number;
  qty: string;
  unitCost: string;
};

function newLine(): LineDraft {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `line-${Math.random().toString(36).slice(2)}`;
  return {
    key,
    itemId: 0,
    qty: "",
    unitCost: "",
  };
}

function parseMoneyField(t: string): number {
  const n = Number(String(t).trim().replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

const underlineInputClass = cn(
  "h-10 w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-sm shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
);

export default function PurchaseOrdersPage() {
  const [supplierId, setSupplierId] = useState(0);
  const [orderedAt, setOrderedAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [items, setItems] = useState<ItemBrief[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      setSuppliersLoading(true);
      setItemsLoading(true);
      const [supRes, itRes] = await Promise.all([
        apiJson<{ items: SupplierBrief[] }>(
          "/suppliers?page=1&pageSize=500"
        ),
        apiJson<{ items: ItemBrief[] }>("/items?page=1&pageSize=500"),
      ]);
      if (cancelled) return;
      if (supRes.ok && Array.isArray(supRes.data?.items))
        setSuppliers(supRes.data.items);
      else setSuppliers([]);
      if (itRes.ok && Array.isArray(itRes.data?.items))
        setItems(itRes.data.items);
      else setItems([]);
      setSuppliersLoading(false);
      setItemsLoading(false);
    }
    void loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  const itemPickerOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: `${i.sku} — ${i.name}`,
      })),
    [items]
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (supplierId < 1) {
      setMsg("Pick a supplier.");
      return;
    }
    const parsedLines: {
      item_id: number;
      qty_ordered: number;
      unit_cost: number;
    }[] = [];

    for (const row of lines) {
      if (row.itemId < 1) continue;
      const q = parseMoneyField(row.qty);
      const c = parseMoneyField(row.unitCost);
      if (!Number.isFinite(q) || q <= 0) {
        setMsg("Each line with an item needs a quantity greater than zero.");
        return;
      }
      if (!Number.isFinite(c) || c < 0) {
        setMsg("Each line needs a unit cost zero or greater.");
        return;
      }
      parsedLines.push({
        item_id: row.itemId,
        qty_ordered: q,
        unit_cost: c,
      });
    }

    if (parsedLines.length < 1) {
      setMsg("Add at least one line with an item.");
      return;
    }

    setSubmitting(true);
    const res = await apiJson<{ id: number }>("/purchase-orders", {
      method: "POST",
      body: JSON.stringify({
        supplier_id: supplierId,
        ordered_at: orderedAt,
        lines: parsedLines,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.error ?? "Failed to create PO");
      return;
    }
    setMsg(`Created PO id ${res.data?.id ?? "—"}`);
    setSupplierId(0);
    setOrderedAt(new Date().toISOString().slice(0, 10));
    setLines([newLine()]);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>Create purchase order</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a supplier by name and add lines with searchable items —
            aligns with procurement in the POS proposal (create PO for
            suppliers).{" "}
            <Link
              href="/dashboard/purchase-order-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Browse purchase order history
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-col gap-8">
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="po-supplier">Supplier</Label>
                <CatalogIdCombobox
                  id="po-supplier"
                  items={suppliers.map((s) => ({
                    id: s.id,
                    name: `${s.name} (${s.id})`,
                  }))}
                  valueId={supplierId}
                  onValueChange={setSupplierId}
                  placeholder="Search supplier…"
                  loading={suppliersLoading}
                  emptyListHint="No suppliers"
                  emptyFilterHint="No matching suppliers"
                  variant="underline"
                />
              </div>
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="po-date">Ordered at</Label>
                <Input
                  id="po-date"
                  type="date"
                  value={orderedAt}
                  onChange={(e) => setOrderedAt(e.target.value)}
                  className={underlineInputClass}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <Label className="text-base font-medium">Lines</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLines((L) => [...L, newLine()])}
                >
                  <PlusIcon className="mr-1 size-4" />
                  Add line
                </Button>
              </div>

              <div className="-mx-1 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">
                        Item
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Quantity
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Unit cost
                      </th>
                      <th className="w-px px-3 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row, idx) => (
                      <tr key={row.key} className="border-b border-border/60">
                        <td className="px-3 py-2 align-middle">
                          <SearchableNumPicker
                            id={`po-line-it-${idx}`}
                            options={itemPickerOptions}
                            valueId={row.itemId}
                            onValueChange={(id) => {
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key ? { ...l, itemId: id } : l
                                )
                              );
                            }}
                            placeholder="Pick item…"
                            loading={itemsLoading}
                            emptyListHint="No items"
                            emptyFilterHint="No matching items"
                            variant="underline"
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <Input
                            aria-label="Quantity ordered"
                            inputMode="decimal"
                            value={row.qty}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key ? { ...l, qty: v } : l
                                )
                              );
                            }}
                            placeholder="e.g. 10"
                            className={underlineInputClass}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <Input
                            aria-label="Unit cost"
                            inputMode="decimal"
                            value={row.unitCost}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? { ...l, unitCost: v }
                                    : l
                                )
                              );
                            }}
                            placeholder="e.g. 5"
                            className={underlineInputClass}
                          />
                        </td>
                        <td className="px-1 py-2 align-middle">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label="Remove line"
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((prev) =>
                                prev.length <= 1
                                  ? prev
                                  : prev.filter((l) => l.key !== row.key)
                              )
                            }
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex max-w-xl flex-col gap-2 pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="inline-flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
              {msg ? (
                <p
                  className={cn(
                    "text-sm",
                    /^Created/i.test(msg)
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
                  role="status"
                >
                  {msg}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
