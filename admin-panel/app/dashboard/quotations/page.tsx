"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import { useRouteAccess } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { SearchableNumPicker } from "@/components/searchable-num-picker";

type CustomerBrief = { id: number; name: string };
type ItemBrief = {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  unit_price?: number | string;
};

type LineDraft = {
  key: string;
  itemId: number;
  description: string;
  qty: string;
  unitPrice: string;
};

function newLine(): LineDraft {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `q-${Math.random().toString(36).slice(2)}`;
  return { key, itemId: 0, description: "", qty: "", unitPrice: "" };
}

function defaultDescriptionForItem(item: ItemBrief | undefined): string {
  if (!item) return "";
  const desc = String(item.description ?? "").trim();
  if (desc) return desc;
  return String(item.name ?? "").trim();
}

function defaultUnitPriceForItem(item: ItemBrief | undefined): string {
  if (!item) return "";
  const n = Number(item.unit_price);
  return Number.isFinite(n) && n >= 0 ? String(n) : "";
}

function parseQtyOrMoney(t: string): number {
  const n = Number(String(t).trim().replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function moneyDisplay(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const underlineInputClass = cn(
  "h-10 w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-sm shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
);

const underlineTextareaClass = cn(
  "min-h-[76px] w-full resize-y rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-sm shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-0 focus-visible:outline-none dark:bg-transparent"
);

export default function QuotationsPage() {
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [items, setItems] = useState<ItemBrief[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const [customerId, setCustomerId] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [formMsg, setFormMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { canEdit } = useRouteAccess();

  const itemsById = useMemo(() => {
    const m = new Map<number, ItemBrief>();
    for (const i of items) m.set(i.id, i);
    return m;
  }, [items]);

  const itemPickerOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: `${i.sku} — ${i.name}`,
      })),
    [items]
  );

  const linePreviewTotal = useMemo(() => {
    let s = 0;
    for (const row of lines) {
      if (row.itemId < 1) continue;
      const q = parseQtyOrMoney(row.qty);
      const p = parseQtyOrMoney(row.unitPrice);
      if (Number.isFinite(q) && Number.isFinite(p)) s += q * p;
    }
    return s;
  }, [lines]);

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    const [custRes, itRes] = await Promise.all([
      apiJson<{ items: CustomerBrief[] }>("/customers?page=1&pageSize=500"),
      apiJson<{ items: ItemBrief[] }>("/items?page=1&pageSize=500"),
    ]);
    if (custRes.ok && Array.isArray(custRes.data?.items))
      setCustomers(custRes.data.items);
    else setCustomers([]);
    if (itRes.ok && Array.isArray(itRes.data?.items)) setItems(itRes.data.items);
    else setItems([]);
    setMetaLoading(false);
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  async function createQuotation(e: React.FormEvent) {
    e.preventDefault();
    setFormMsg(null);
    if (customerId < 1) {
      setFormMsg("Pick a customer.");
      return;
    }
    const parsed: {
      item_id: number;
      description: string | null;
      qty: number;
      unit_price: number;
    }[] = [];
    for (const row of lines) {
      if (row.itemId < 1) continue;
      const q = parseQtyOrMoney(row.qty);
      const p = parseQtyOrMoney(row.unitPrice);
      if (!Number.isFinite(q) || q <= 0) {
        setFormMsg(
          "Each line with an item needs a quantity greater than zero."
        );
        return;
      }
      if (!Number.isFinite(p) || p < 0) {
        setFormMsg("Each line needs a unit price zero or greater.");
        return;
      }
      const desc = row.description.trim();
      parsed.push({
        item_id: row.itemId,
        description: desc === "" ? null : desc,
        qty: q,
        unit_price: p,
      });
    }
    if (parsed.length < 1) {
      setFormMsg("Add at least one line with an item.");
      return;
    }

    const vu = validUntil.trim();
    const n = notes.trim();

    setSubmitting(true);
    const res = await apiJson<{ id: number }>("/quotations", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        valid_until: vu === "" ? null : vu,
        notes: n === "" ? null : n,
        lines: parsed,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormMsg(res.error ?? "Failed to create quotation");
      return;
    }
    setFormMsg(`Created quotation id ${res.data?.id ?? "—"}`);
    setCustomerId(0);
    setValidUntil("");
    setNotes("");
    setLines([newLine()]);
  }

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">
            You have view-only access for this module.
          </p>
          <Link
            href="/dashboard/quotation-history"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Quotation history
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl border-border/80">
      <CardHeader>
        <CardTitle>Quotations</CardTitle>
        <CardDescription>
          Create a quote for a customer with searchable lines. Tax stays zero in
          this build; totals follow line subtotals.{" "}
          <Link
            href="/dashboard/quotation-history"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Browse quotation history
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={createQuotation} className="flex flex-col gap-8">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
              <Label htmlFor="qt-customer">Customer</Label>
              <CatalogIdCombobox
                id="qt-customer"
                items={customers.map((c) => ({
                  id: c.id,
                  name: `${c.name} (${c.id})`,
                }))}
                valueId={customerId}
                onValueChange={setCustomerId}
                placeholder="Search customer…"
                loading={metaLoading}
                emptyListHint="No customers"
                emptyFilterHint="No matching customers"
                variant="underline"
              />
            </div>
            <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
              <Label htmlFor="qt-valid">Valid until (optional)</Label>
              <Input
                id="qt-valid"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className={underlineInputClass}
              />
            </div>
            <div className="min-w-0 space-y-2 sm:col-span-2">
              <Label htmlFor="qt-notes">Notes (optional)</Label>
              <textarea
                id="qt-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={underlineTextareaClass}
                placeholder="Internal notes…"
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <Label className="text-base font-medium">Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((L) => [...L, newLine()])}
              >
                <PlusIcon className="mr-1 size-4" />
                Add item
              </Button>
            </div>
            <div className="space-y-3">
              {lines.map((row, idx) => {
                const q = parseQtyOrMoney(row.qty);
                const p = parseQtyOrMoney(row.unitPrice);
                const lineTotal =
                  row.itemId > 0 &&
                  Number.isFinite(q) &&
                  Number.isFinite(p) &&
                  q > 0 &&
                  p >= 0
                    ? q * p
                    : null;

                return (
                  <div
                    key={row.key}
                    className="space-y-3 rounded-md border border-border p-3 sm:p-4"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor={`qt-line-it-${idx}`}>Item</Label>
                        <SearchableNumPicker
                          id={`qt-line-it-${idx}`}
                          options={itemPickerOptions}
                          valueId={row.itemId}
                          onValueChange={(id) => {
                            setLines((prev) =>
                              prev.map((l) => {
                                if (l.key !== row.key) return l;
                                if (id < 1) {
                                  return {
                                    ...l,
                                    itemId: 0,
                                    description: "",
                                    qty: "",
                                    unitPrice: "",
                                  };
                                }
                                const picked = itemsById.get(id);
                                return {
                                  ...l,
                                  itemId: id,
                                  description: defaultDescriptionForItem(picked),
                                  qty: l.qty.trim() === "" ? "1" : l.qty,
                                  unitPrice: defaultUnitPriceForItem(picked),
                                };
                              })
                            );
                          }}
                          placeholder="Pick item…"
                          loading={metaLoading}
                          emptyListHint="No items"
                          emptyFilterHint="No matching items"
                          variant="underline"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-7 shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={lines.length <= 1}
                        aria-label="Remove item"
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
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`qt-line-desc-${idx}`}>Description</Label>
                      <textarea
                        id={`qt-line-desc-${idx}`}
                        value={row.description}
                        onChange={(e) => {
                          const v = e.target.value;
                          setLines((prev) =>
                            prev.map((l) =>
                              l.key === row.key ? { ...l, description: v } : l
                            )
                          );
                        }}
                        className={cn(underlineTextareaClass, "min-h-[56px]")}
                        placeholder="Selected item description…"
                        rows={2}
                        maxLength={500}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor={`qt-line-qty-${idx}`}>Quantity</Label>
                        <Input
                          id={`qt-line-qty-${idx}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={row.qty}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === row.key ? { ...l, qty: v } : l
                              )
                            );
                          }}
                          placeholder="e.g. 2"
                          className={underlineInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`qt-line-price-${idx}`}>Unit price</Label>
                        <Input
                          id={`qt-line-price-${idx}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step="any"
                          value={row.unitPrice}
                          onChange={(e) => {
                            const v = e.target.value;
                            setLines((prev) =>
                              prev.map((l) =>
                                l.key === row.key ? { ...l, unitPrice: v } : l
                              )
                            );
                          }}
                          placeholder="e.g. 25"
                          className={underlineInputClass}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Item total</Label>
                        <p className="flex h-10 items-center px-1 text-sm tabular-nums text-foreground">
                          {lineTotal == null ? "—" : moneyDisplay(lineTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">
              Draft subtotal preview:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {moneyDisplay(linePreviewTotal)}
              </span>
            </p>
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
                  Saving…
                </>
              ) : (
                "Create quotation"
              )}
            </Button>
            {formMsg ? (
              <p
                className={cn(
                  "text-sm",
                  /^Created/i.test(formMsg)
                    ? "text-muted-foreground"
                    : "text-destructive"
                )}
                role="status"
              >
                {formMsg}
              </p>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
