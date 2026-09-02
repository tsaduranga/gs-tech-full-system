"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import {
  SearchableNumPicker,
  type NumOption,
} from "@/components/searchable-num-picker";
import { fmtRs, lineAmountExVat, documentTotals } from "@/lib/document-totals";
import {
  DEFAULT_ITEM_TAX_RATES,
  formatTaxPercent,
  taxRatesFromApi,
} from "@/lib/item-pricing";
import type { PurchaseOrderDetail } from "@/lib/purchase-order-print";
import { formatWarrantyDisplay } from "@/lib/warranty-format";

type SupplierBrief = { id: number; name: string };

type WarehouseRow = { id: number; code: string; name: string };

type PoRow = {
  id: number;
  supplier_id: number;
  order_number: string;
  supplier_name: string;
  status: string;
  ordered_at?: string;
};

type PoLineRow = {
  id: number;
  item_id: number;
  sku: string;
  item_name?: string;
  qty_ordered: number | string;
  qty_received: number | string;
  unit_cost: number | string;
  supplier_warranties?: {
    id: number;
    name: string;
    warranty_years: number;
    warranty_months: number;
  }[];
};

function fmtDate(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function num(v: number | string | undefined) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

const underlineInputClass = cn(
  "h-10 w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-sm shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
);

function DetailBox({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border text-sm">
      <div className="border-b border-border bg-muted/40 px-3 py-2 text-center text-xs font-semibold">
        {title}
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-2 px-3 py-1.5">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value ?? "—"}</span>
    </div>
  );
}

export default function GoodsReceiptsPage() {
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierId, setSupplierId] = useState(0);
  const [pos, setPos] = useState<PoRow[]>([]);
  const [poLoading, setPoLoading] = useState(false);
  const [poId, setPoId] = useState(0);
  const [poDetail, setPoDetail] = useState<PurchaseOrderDetail | null>(null);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [linesLoading, setLinesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState("");
  const [supplierInvoiceError, setSupplierInvoiceError] = useState<string | null>(
    null
  );
  const [warehouseId, setWarehouseId] = useState(0);
  const [warehouseError, setWarehouseError] = useState<string | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<NumOption[]>([]);
  const [warehousesLoading, setWarehousesLoading] = useState(true);
  const [vatRate, setVatRate] = useState(DEFAULT_ITEM_TAX_RATES.vatRate);

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    const res = await apiJson<{ items: SupplierBrief[] }>(
      "/suppliers?page=1&pageSize=500"
    );
    if (res.ok && Array.isArray(res.data?.items)) setSuppliers(res.data.items);
    else setSuppliers([]);
    setSuppliersLoading(false);
  }, []);

  const loadPos = useCallback(async (forSupplierId: number) => {
    if (forSupplierId < 1) {
      setPos([]);
      setPoLoading(false);
      return;
    }
    setPoLoading(true);
    const qs = (status: string) =>
      `/purchase-orders?page=1&pageSize=200&status=${status}&supplier_id=${forSupplierId}`;
    const [openRes, partialRes] = await Promise.all([
      apiJson<{ items: PoRow[] }>(qs("OPEN")),
      apiJson<{ items: PoRow[] }>(qs("PARTIAL")),
    ]);
    const map = new Map<number, PoRow>();
    if (openRes.ok && openRes.data?.items) {
      for (const r of openRes.data.items) map.set(r.id, r);
    }
    if (partialRes.ok && partialRes.data?.items) {
      for (const r of partialRes.data.items) map.set(r.id, r);
    }
    setPos([...map.values()].sort((x, y) => y.id - x.id));
    setPoLoading(false);
  }, []);

  useEffect(() => {
    void loadSuppliers();
    void apiJson<{ vat_rate: number }>("/settings").then((res) => {
      if (res.ok && res.data) setVatRate(taxRatesFromApi(res.data).vatRate);
    });
    void (async () => {
      setWarehousesLoading(true);
      const res = await apiJson<{ items: WarehouseRow[] }>(
        "/warehouses?page=1&pageSize=500"
      );
      if (res.ok && Array.isArray(res.data?.items)) {
        setWarehouseOptions(
          res.data.items.map((w) => ({
            value: w.id,
            label: `${w.code} — ${w.name}`,
          }))
        );
      } else setWarehouseOptions([]);
      setWarehousesLoading(false);
    })();
  }, [loadSuppliers]);

  useEffect(() => {
    setPoId(0);
    setPoDetail(null);
    setLines([]);
    setSupplierInvoiceNo("");
    setSupplierInvoiceError(null);
    setWarehouseId(0);
    setWarehouseError(null);
    setMsg(null);
    if (supplierId < 1) {
      setPos([]);
      return;
    }
    void loadPos(supplierId);
  }, [supplierId, loadPos]);

  useEffect(() => {
    if (poId < 1) {
      setPoDetail(null);
      setLines([]);
      return;
    }
    let cancelled = false;
    async function run() {
      setLinesLoading(true);
      const [detailRes, linesRes] = await Promise.all([
        apiJson<PurchaseOrderDetail>(`/purchase-orders/${poId}`),
        apiJson<PoLineRow[]>(`/purchase-orders/${poId}/lines`, {}),
      ]);
      if (cancelled) return;
      setLinesLoading(false);
      if (detailRes.ok && detailRes.data) setPoDetail(detailRes.data);
      else setPoDetail(null);
      if (linesRes.ok && Array.isArray(linesRes.data)) setLines(linesRes.data);
      else setLines([]);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [poId]);

  const poOptions = useMemo(
    () =>
      pos.map((p) => ({
        value: p.id,
        label: `${p.order_number} — ${p.status}${p.ordered_at ? ` — ${fmtDate(p.ordered_at)}` : ""}`,
      })),
    [pos]
  );

  const receivableLines = useMemo(
    () =>
      lines
        .map((ln) => {
          const ordered = num(ln.qty_ordered);
          const got = num(ln.qty_received);
          const rem = Math.max(0, ordered - got);
          return { ...ln, ordered, got, rem };
        })
        .filter((ln) => ln.rem > 1e-9),
    [lines]
  );

  const totals = useMemo(
    () =>
      documentTotals(
        receivableLines.map((ln) => ({
          qty: ln.ordered,
          unitExVat: num(ln.unit_cost),
        })),
        vatRate,
        0
      ),
    [receivableLines, vatRate]
  );

  const vatLabel = formatTaxPercent(vatRate);

  async function submitReceive(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    let hasFieldError = false;
    if (supplierId < 1) {
      setMsg("Select a supplier.");
      return;
    }
    if (poId < 1) {
      setMsg("Select a purchase order.");
      return;
    }
    const invoiceNo = supplierInvoiceNo.trim();
    if (!invoiceNo) {
      setSupplierInvoiceError("Supplier GRN invoice number is required");
      hasFieldError = true;
    } else {
      setSupplierInvoiceError(null);
    }
    if (warehouseId < 1) {
      setWarehouseError("Warehouse is required");
      hasFieldError = true;
    } else {
      setWarehouseError(null);
    }
    if (hasFieldError) {
      setMsg("Please fix the highlighted fields.");
      return;
    }
    const linePayload = receivableLines.map((ln) => ({
      purchase_order_line_id: ln.id,
      qty: ln.rem,
    }));
    if (linePayload.length === 0) {
      setMsg("Nothing left to receive on this purchase order.");
      return;
    }
    setSubmitting(true);
    const res = await apiJson<{ receipt_id: number }>(
      `/purchase-orders/${poId}/receive`,
      {
        method: "POST",
        body: JSON.stringify({
          supplier_invoice_number: invoiceNo,
          warehouse_id: warehouseId,
          lines: linePayload,
        }),
      }
    );
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.error ?? "Receive failed");
      return;
    }
    setMsg(`GRN posted (receipt id ${res.data?.receipt_id ?? "—"})`);
    setPoId(0);
    setPoDetail(null);
    setLines([]);
    setSupplierInvoiceNo("");
    setWarehouseId(0);
    void loadPos(supplierId);
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>Goods receipt (GRN)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Receive outstanding stock against an open purchase order.{" "}
            <Link
              href="/dashboard/goods-receipt-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              GRN history
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitReceive} className="flex flex-col gap-8">
            <div className="max-w-xl space-y-6">
              <div className="space-y-2">
                <Label htmlFor="grn-supplier">
                  Supplier<span className="text-destructive">*</span>
                </Label>
                <CatalogIdCombobox
                  id="grn-supplier"
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
              <div className="space-y-2">
                <Label htmlFor="grn-po">
                  Purchase order<span className="text-destructive">*</span>
                </Label>
                <SearchableNumPicker
                  id="grn-po"
                  options={poOptions}
                  valueId={poId}
                  onValueChange={(id) => {
                    setPoId(id);
                    setSupplierInvoiceNo("");
                    setSupplierInvoiceError(null);
                    setWarehouseId(0);
                    setWarehouseError(null);
                    setMsg(null);
                  }}
                  disabled={supplierId < 1}
                  placeholder={
                    supplierId < 1
                      ? "Select a supplier first…"
                      : poLoading
                        ? "Loading open POs…"
                        : "Pick an open purchase order…"
                  }
                  loading={poLoading}
                  emptyListHint="No open purchase orders for this supplier"
                  emptyFilterHint="No matches"
                  variant="underline"
                />
              </div>

              {poId > 0 ? (
                <div className="space-y-2 border-t border-border pt-6">
                  <Label htmlFor="grn-supplier-invoice">
                    Supplier GRN invoice number
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="grn-supplier-invoice"
                    value={supplierInvoiceNo}
                    onChange={(e) => {
                      setSupplierInvoiceNo(e.target.value);
                      setSupplierInvoiceError(null);
                      setMsg(null);
                    }}
                    placeholder="e.g. INV-2026-0042"
                    aria-invalid={Boolean(supplierInvoiceError)}
                    className={cn(
                      underlineInputClass,
                      supplierInvoiceError &&
                        "border-destructive focus-visible:border-destructive"
                    )}
                  />
                  {supplierInvoiceError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {supplierInvoiceError}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Invoice or delivery note number from the supplier for this
                      receipt.
                    </p>
                  )}
                </div>
              ) : null}
            </div>

            {linesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading purchase order…
              </div>
            ) : poDetail ? (
              <div className="flex flex-col gap-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailBox title="Purchase order">
                    <DetailRow label="PO No" value={poDetail.order_number} />
                    <DetailRow label="Ordered" value={fmtDate(poDetail.ordered_at)} />
                    <DetailRow label="Status" value={poDetail.status} />
                    <DetailRow
                      label="Prepared by"
                      value={poDetail.created_by_username ?? "—"}
                    />
                  </DetailBox>
                  <DetailBox title="Supplier">
                    <DetailRow label="Name" value={poDetail.supplier_name} />
                    <DetailRow label="TIN" value={poDetail.supplier_vat_number ?? "—"} />
                    <DetailRow label="Address" value={poDetail.supplier_address ?? "—"} />
                    <DetailRow
                      label="Telephone"
                      value={poDetail.supplier_telephone ?? "—"}
                    />
                  </DetailBox>
                </div>

                {poDetail.notes ? (
                  <DetailBox title="Notes">
                    <DetailRow label="Notes" value={poDetail.notes} />
                  </DetailBox>
                ) : null}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <Label className="text-base">Items to receive</Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Line totals and summary for goods on{" "}
                        <span className="font-medium text-foreground">
                          {poDetail.order_number}
                        </span>
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {receivableLines.length} line
                      {receivableLines.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full min-w-[860px] table-fixed text-sm">
                      <thead className="border-b bg-muted/40 text-muted-foreground">
                        <tr>
                          <th className="w-12 px-2 py-2 text-left">Ref.</th>
                          <th className="px-3 py-2 text-left">
                            Description of goods or services
                          </th>
                          <th className="w-[22%] px-3 py-2 text-left">
                            Supplier warranties
                          </th>
                          <th className="w-20 px-3 py-2 text-right">Ordered</th>
                          <th className="w-24 px-3 py-2 text-right">Unit price</th>
                          <th className="w-28 px-3 py-2 text-right">
                            Amount excl. VAT (Rs.)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {receivableLines.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-3 py-8 text-center text-muted-foreground"
                            >
                              All lines on this PO are fully received.
                            </td>
                          </tr>
                        ) : (
                          receivableLines.map((ln, idx) => {
                            const unit = num(ln.unit_cost);
                            const amount = lineAmountExVat(ln.ordered, unit);
                            const warrantyText =
                              (ln.supplier_warranties ?? [])
                                .map((w) =>
                                  formatWarrantyDisplay(
                                    w.name,
                                    w.warranty_years,
                                    w.warranty_months
                                  )
                                )
                                .join(", ") || "—";
                            return (
                              <tr
                                key={ln.id}
                                className="border-b border-border/60"
                              >
                                <td className="px-2 py-2 tabular-nums text-muted-foreground">
                                  {idx + 1}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="font-mono text-xs">{ln.sku}</span>
                                  {ln.item_name ? (
                                    <>
                                      <span className="text-muted-foreground">
                                        {" "}
                                        —{" "}
                                      </span>
                                      {ln.item_name}
                                    </>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 text-xs text-muted-foreground">
                                  {warrantyText}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmtRs(ln.ordered)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums">
                                  {fmtRs(unit)}
                                </td>
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {fmtRs(amount)}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {receivableLines.length > 0 ? (
                        <tfoot>
                          <tr className="border-t border-border bg-muted/20">
                            <td colSpan={5} className="px-3 py-2 text-right font-medium">
                              Total value of supply
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums">
                              {fmtRs(totals.totalExVat)}
                            </td>
                          </tr>
                          <tr className="bg-muted/20">
                            <td
                              colSpan={5}
                              className="px-3 py-2 text-right text-muted-foreground"
                            >
                              VAT amount (total value of supply @ {vatLabel}%)
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtRs(totals.vatAmount)}
                            </td>
                          </tr>
                          <tr className="bg-muted/20">
                            <td colSpan={5} className="px-3 py-2 text-right font-semibold">
                              Total amount including VAT
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {fmtRs(totals.totalIncVat)}
                            </td>
                          </tr>
                          <tr className="bg-muted/20">
                            <td
                              colSpan={5}
                              className="px-3 py-2 text-right text-muted-foreground"
                            >
                              Delivery charges
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtRs(totals.deliveryCharges)}
                            </td>
                          </tr>
                          <tr className="border-t border-border bg-muted/30">
                            <td colSpan={5} className="px-3 py-2 text-right font-semibold">
                              Total amount including delivery charges
                            </td>
                            <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">
                              {fmtRs(totals.grandTotal)}
                            </td>
                          </tr>
                        </tfoot>
                      ) : null}
                    </table>
                  </div>
                </div>
              </div>
            ) : poId > 0 ? (
              <p className="text-sm text-muted-foreground">
                Could not load purchase order details.
              </p>
            ) : null}

            <div className="flex max-w-xl flex-col gap-4">
              {poId > 0 && receivableLines.length > 0 ? (
                <div className="space-y-2 border-t border-border pt-6">
                  <Label htmlFor="grn-warehouse">
                    Warehouse<span className="text-destructive">*</span>
                  </Label>
                  <SearchableNumPicker
                    id="grn-warehouse"
                    options={warehouseOptions}
                    valueId={warehouseId}
                    onValueChange={(id) => {
                      setWarehouseId(id);
                      setWarehouseError(null);
                      setMsg(null);
                    }}
                    placeholder={
                      warehousesLoading
                        ? "Loading warehouses…"
                        : "Select receiving warehouse…"
                    }
                    loading={warehousesLoading}
                    invalid={Boolean(warehouseError)}
                    emptyListHint="No warehouses"
                    emptyFilterHint="No matching warehouses"
                    variant="underline"
                  />
                  {warehouseError ? (
                    <p className="text-xs text-destructive" role="alert">
                      {warehouseError}
                    </p>
                  ) : warehouseOptions.length === 0 && !warehousesLoading ? (
                    <p className="text-xs text-destructive" role="alert">
                      No warehouses available. Ask an administrator to set up
                      warehouses or grant warehouse access.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Stock from this receipt will be added to the selected
                      warehouse.
                    </p>
                  )}
                </div>
              ) : null}
              <Button
                type="submit"
                size="lg"
                disabled={
                  submitting ||
                  supplierId < 1 ||
                  poId < 1 ||
                  receivableLines.length === 0
                }
              >
                {submitting ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    Posting…
                  </>
                ) : (
                  "Post goods receipt"
                )}
              </Button>
              {msg ? (
                <p
                  className={cn(
                    "text-sm",
                    /^GRN posted/i.test(msg)
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
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
