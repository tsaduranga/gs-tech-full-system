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

type CustomerBrief = { id: number; name: string };
type WarehouseRow = { id: number; code: string; name: string };
type ItemBrief = { id: number; sku: string; name: string };

type LineDraft = {
  key: string;
  itemId: number;
  qty: string;
  unitPrice: string;
};

function newLine(): LineDraft {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `line-${Math.random().toString(36).slice(2)}`;
  return { key, itemId: 0, qty: "", unitPrice: "" };
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

export default function CustomerReturnsPage() {
  const [customerId, setCustomerId] = useState(0);
  const [warehouseId, setWarehouseId] = useState(0);
  const [invoiceId, setInvoiceId] = useState(0);
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [custLoading, setCustLoading] = useState(true);
  const [whLoading, setWhLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [invLoading, setInvLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [items, setItems] = useState<ItemBrief[]>([]);
  const [invoiceOpts, setInvoiceOpts] = useState<{ value: number; label: string }[]>(
    []
  );

  useEffect(() => {
    let c = false;
    async function load() {
      setCustLoading(true);
      setWhLoading(true);
      setItemsLoading(true);
      const [custRes, wRes, iRes] = await Promise.all([
        apiJson<{ items: CustomerBrief[] }>("/customers?page=1&pageSize=500"),
        apiJson<{ items: WarehouseRow[] }>("/warehouses?page=1&pageSize=500"),
        apiJson<{ items: ItemBrief[] }>("/items?page=1&pageSize=500"),
      ]);
      if (c) return;
      setCustomers(
        custRes.ok && Array.isArray(custRes.data?.items) ? custRes.data.items : []
      );
      setWarehouses(
        wRes.ok && Array.isArray(wRes.data?.items) ? wRes.data.items : []
      );
      setItems(iRes.ok && Array.isArray(iRes.data?.items) ? iRes.data.items : []);
      setCustLoading(false);
      setWhLoading(false);
      setItemsLoading(false);
    }
    void load();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    if (customerId < 1) {
      setInvoiceOpts([]);
      setInvoiceId(0);
      return;
    }
    let c = false;
    async function inv() {
      setInvLoading(true);
      const res = await apiJson<{
        items: {
          id: number;
          invoice_number: string;
          balance_due: number | string;
        }[];
      }>(`/invoices?page=1&pageSize=200&customer_id=${customerId}`);
      setInvLoading(false);
      if (c || !res.ok || !Array.isArray(res.data?.items)) {
        if (!c) setInvoiceOpts([]);
        return;
      }
      setInvoiceOpts(
        res.data.items.map((i) => ({
          value: i.id,
          label: `${i.invoice_number} (#${i.id})`,
        }))
      );
    }
    void inv();
    return () => {
      c = true;
    };
  }, [customerId]);

  const itemOpts = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: `${i.sku} — ${i.name}`,
      })),
    [items]
  );

  const whOpts = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: `${w.code} — ${w.name}`,
      })),
    [warehouses]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (customerId < 1 || warehouseId < 1) {
      setMsg("Pick customer and warehouse.");
      return;
    }
    const parsed: {
      item_id: number;
      qty: number;
      unit_price: number;
      invoice_line_id: null;
    }[] = [];
    for (const row of lines) {
      if (row.itemId < 1) continue;
      const q = parseMoneyField(row.qty);
      const p = parseMoneyField(row.unitPrice);
      if (!Number.isFinite(q) || q <= 0) {
        setMsg("Each line needs quantity greater than zero.");
        return;
      }
      if (!Number.isFinite(p) || p < 0) {
        setMsg("Unit price must be zero or greater.");
        return;
      }
      parsed.push({
        item_id: row.itemId,
        qty: q,
        unit_price: p,
        invoice_line_id: null,
      });
    }
    if (parsed.length < 1) {
      setMsg("Add at least one line.");
      return;
    }
    setSubmitting(true);
    const res = await apiJson<{ id: number }>("/customer-returns", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        warehouse_id: warehouseId,
        invoice_id: invoiceId > 0 ? invoiceId : null,
        notes: null,
        lines: parsed,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.error ?? "Failed");
      return;
    }
    setMsg(`Customer return created (id ${res.data?.id ?? "—"})`);
    setLines([newLine()]);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>Customer return</CardTitle>
          <p className="text-sm text-muted-foreground">
            Restock items a customer brought back. Optional link to an invoice
            for traceability.{" "}
            <Link
              href="/dashboard/customer-return-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              History
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-8">
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                <Label>Customer</Label>
                <CatalogIdCombobox
                  id="cr-cust"
                  items={customers.map((c) => ({
                    id: c.id,
                    name: `${c.name} (${c.id})`,
                  }))}
                  valueId={customerId}
                  onValueChange={setCustomerId}
                  placeholder="Search…"
                  loading={custLoading}
                  variant="underline"
                  emptyListHint="No customers"
                  emptyFilterHint="No matches"
                />
              </div>
              <div className="space-y-2 sm:col-span-2 xl:col-span-1">
                <Label>Warehouse</Label>
                <SearchableNumPicker
                  id="cr-wh"
                  options={whOpts}
                  valueId={warehouseId}
                  onValueChange={setWarehouseId}
                  placeholder="Restock into…"
                  loading={whLoading}
                  variant="underline"
                  emptyListHint="No warehouses"
                  emptyFilterHint="No matches"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Invoice (optional)</Label>
                <SearchableNumPicker
                  id="cr-inv"
                  options={invoiceOpts}
                  valueId={invoiceId}
                  onValueChange={setInvoiceId}
                  placeholder={
                    customerId < 1
                      ? "Pick customer first"
                      : invLoading
                        ? "Loading…"
                        : "Link invoice or leave unassigned"
                  }
                  loading={invLoading}
                  variant="underline"
                  emptyListHint="No invoices for customer"
                  emptyFilterHint="No matches"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-end justify-between gap-2">
                <Label className="text-base">Lines</Label>
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
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-left">Qty</th>
                      <th className="px-3 py-2 text-left">Unit price</th>
                      <th className="w-px px-2" aria-label="Remove" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row, idx) => (
                      <tr key={row.key} className="border-b border-border/60">
                        <td className="px-3 py-2">
                          <SearchableNumPicker
                            id={`cr-it-${idx}`}
                            options={itemOpts}
                            valueId={row.itemId}
                            onValueChange={(id) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key ? { ...l, itemId: id } : l
                                )
                              )
                            }
                            placeholder="Item…"
                            loading={itemsLoading}
                            variant="underline"
                            emptyListHint="No items"
                            emptyFilterHint="No matches"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            inputMode="decimal"
                            value={row.qty}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? { ...l, qty: e.target.value }
                                    : l
                                )
                              )
                            }
                            className={underlineInputClass}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            inputMode="decimal"
                            value={row.unitPrice}
                            onChange={(e) =>
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? { ...l, unitPrice: e.target.value }
                                    : l
                                )
                              )
                            }
                            className={underlineInputClass}
                          />
                        </td>
                        <td className="px-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={lines.length <= 1}
                            onClick={() =>
                              setLines((prev) =>
                                prev.filter((l) => l.key !== row.key)
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

            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                "Create customer return"
              )}
            </Button>
            {msg ? (
              <p
                className={cn(
                  "text-sm",
                  /^Customer return created/i.test(msg)
                    ? "text-muted-foreground"
                    : "text-destructive"
                )}
              >
                {msg}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
