"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiJson } from "@/lib/api";
import {
  DEFAULT_ITEM_TAX_RATES,
  formatTaxPercent,
  taxRatesFromApi,
} from "@/lib/item-pricing";
import { documentTotals, fmtRs, lineAmountExVat } from "@/lib/document-totals";
import { formatWarrantyDisplay } from "@/lib/warranty-format";

export type GoodsReceiptLineDetail = {
  id: number;
  purchase_order_line_id: number;
  item_id: number;
  sku: string;
  item_name: string;
  qty: number | string;
  unit_cost: number | string;
  supplier_warranties?: {
    id: number;
    name: string;
    warranty_years: number;
    warranty_months: number;
  }[];
};

export type GoodsReceiptDetail = {
  id: number;
  purchase_order_id: number;
  order_number: string;
  supplier_id: number;
  supplier_name: string;
  supplier_address?: string | null;
  supplier_vat_number?: string | null;
  supplier_telephone?: string | null;
  supplier_invoice_number: string | null;
  warehouse_id: number | null;
  warehouse_code: string | null;
  warehouse_name: string | null;
  received_at: string;
  created_by_username: string | null;
  lines: GoodsReceiptLineDetail[];
};

function fmtDateTime(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function num(v: number | string | undefined) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

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
    <div className="grid grid-cols-[7.5rem_1fr] gap-x-2 px-3 py-1.5">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value ?? "—"}</span>
    </div>
  );
}

export function GoodsReceiptDetailDialog({
  grnId,
  open,
  onOpenChange,
}: {
  grnId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<GoodsReceiptDetail | null>(null);
  const [vatRate, setVatRate] = useState(DEFAULT_ITEM_TAX_RATES.vatRate);

  useEffect(() => {
    if (!open || grnId == null || grnId < 1) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [grnRes, settingsRes] = await Promise.all([
        apiJson<GoodsReceiptDetail>(`/goods-receipts/${grnId}`),
        apiJson<{ vat_rate: number }>("/settings"),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (!grnRes.ok || !grnRes.data) {
        setDetail(null);
        setError(grnRes.error ?? "Failed to load goods receipt");
        return;
      }
      if (settingsRes.ok && settingsRes.data) {
        setVatRate(taxRatesFromApi(settingsRes.data).vatRate);
      }
      setDetail(grnRes.data);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, grnId]);

  const totals = useMemo(() => {
    if (!detail) return null;
    const computed = detail.lines.map((line) => ({
      qty: num(line.qty),
      unitExVat: num(line.unit_cost),
    }));
    return documentTotals(computed, vatRate, 0);
  }, [detail, vatRate]);

  const vatLabel = formatTaxPercent(vatRate);

  const warehouseLabel =
    detail?.warehouse_code != null
      ? `${detail.warehouse_code}${detail.warehouse_name ? ` — ${detail.warehouse_name}` : ""}`
      : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,920px)] flex-col gap-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle>
            {detail ? `Goods receipt #${detail.id}` : "Goods receipt"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : detail ? (
            <div className="flex flex-col gap-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailBox title="Receipt">
                  <DetailRow label="GRN id" value={detail.id} />
                  <DetailRow label="Received" value={fmtDateTime(detail.received_at)} />
                  <DetailRow label="Posted by" value={detail.created_by_username ?? "—"} />
                  <DetailRow
                    label="Supplier invoice #"
                    value={detail.supplier_invoice_number?.trim() || "—"}
                  />
                  <DetailRow label="Warehouse" value={warehouseLabel} />
                </DetailBox>
                <DetailBox title="Purchase order">
                  <DetailRow label="PO No" value={detail.order_number} />
                  <DetailRow label="PO id" value={detail.purchase_order_id} />
                </DetailBox>
              </div>

              <DetailBox title="Supplier">
                <DetailRow label="Name" value={detail.supplier_name} />
                <DetailRow label="TIN" value={detail.supplier_vat_number ?? "—"} />
                <DetailRow label="Address" value={detail.supplier_address ?? "—"} />
                <DetailRow label="Telephone" value={detail.supplier_telephone ?? "—"} />
              </DetailBox>

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ref.</TableHead>
                      <TableHead>Description of goods or services</TableHead>
                      <TableHead className="min-w-[160px]">Supplier warranties</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">
                        Amount excl. VAT (Rs.)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.lines.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-16 text-center text-muted-foreground"
                        >
                          No lines on this receipt.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.lines.map((line, idx) => {
                        const qty = num(line.qty);
                        const unit = num(line.unit_cost);
                        const amount = lineAmountExVat(qty, unit);
                        const warrantyText =
                          (line.supplier_warranties ?? [])
                            .map((w) =>
                              formatWarrantyDisplay(
                                w.name,
                                w.warranty_years,
                                w.warranty_months
                              )
                            )
                            .join(", ") || "—";
                        return (
                          <TableRow key={line.id}>
                            <TableCell className="tabular-nums">{idx + 1}</TableCell>
                            <TableCell>
                              <span className="font-mono text-xs">{line.sku}</span>
                              <span className="text-muted-foreground"> — </span>
                              {line.item_name}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {warrantyText}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtRs(qty)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {fmtRs(unit)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-medium">
                              {fmtRs(amount)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {totals ? (
                <div className="ml-auto w-full max-w-md space-y-1 rounded-md border border-border p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Total value of supply</span>
                    <span className="tabular-nums font-medium">
                      {fmtRs(totals.totalExVat)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      VAT amount (total value of supply @ {vatLabel}%)
                    </span>
                    <span className="tabular-nums">{fmtRs(totals.vatAmount)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                    <span>Total amount including VAT</span>
                    <span className="tabular-nums">{fmtRs(totals.totalIncVat)}</span>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
