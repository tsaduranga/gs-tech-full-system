"use client";

import Image from "next/image";
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
import { DEFAULT_COMPANY_PROFILE } from "@/lib/company-profile";
import { cn } from "@/lib/utils";
import {
  DEFAULT_ITEM_TAX_RATES,
  formatTaxPercent,
  taxRatesFromApi,
} from "@/lib/item-pricing";
import { fmtRs, lineAmountExVat } from "@/lib/document-totals";
import { formatWarrantyDisplay } from "@/lib/warranty-format";
import {
  purchaseOrderTotals,
  type PurchaseOrderDetail,
} from "@/lib/purchase-order-print";

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

function DetailBox({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border border-border text-sm", className)}>
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        status === "OPEN" && "bg-blue-500/15 text-blue-700 dark:text-blue-300",
        status === "PARTIAL" &&
          "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        status === "CLOSED" && "bg-muted text-foreground",
        status === "DRAFT" && "bg-zinc-500/15 text-foreground"
      )}
    >
      {status}
    </span>
  );
}

export function PurchaseOrderDetailDialog({
  poId,
  open,
  onOpenChange,
}: {
  poId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null);
  const [vatRate, setVatRate] = useState(DEFAULT_ITEM_TAX_RATES.vatRate);
  const company = DEFAULT_COMPANY_PROFILE;

  useEffect(() => {
    if (!open || poId == null || poId < 1) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [poRes, settingsRes] = await Promise.all([
        apiJson<PurchaseOrderDetail>(`/purchase-orders/${poId}`),
        apiJson<{ vat_rate: number }>("/settings"),
      ]);
      if (cancelled) return;
      setLoading(false);
      if (!poRes.ok || !poRes.data) {
        setDetail(null);
        setError(poRes.error ?? "Failed to load purchase order");
        return;
      }
      if (settingsRes.ok && settingsRes.data) {
        setVatRate(taxRatesFromApi(settingsRes.data).vatRate);
      }
      setDetail(poRes.data);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, poId]);

  const totals = useMemo(
    () => (detail ? purchaseOrderTotals(detail, vatRate) : null),
    [detail, vatRate]
  );

  const vatLabel = formatTaxPercent(vatRate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,920px)] flex-col gap-0 sm:max-w-5xl"
      >
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle>
            {detail ? `Purchase order ${detail.order_number}` : "Purchase order"}
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
              <div className="flex items-center gap-4 border border-border p-4">
                <Image
                  src={company.logoUrl}
                  alt={company.name}
                  width={160}
                  height={54}
                  className="h-12 w-auto shrink-0 object-contain"
                />
                <div className="min-w-0 flex-1 text-center">
                  <p className="text-lg font-bold">{company.name}</p>
                  <p className="text-sm font-medium text-muted-foreground">
                    Purchase Order
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailBox title="Order dates">
                  <DetailRow label="Date of order" value={fmtDate(detail.ordered_at)} />
                  <DetailRow label="Due date" value="—" />
                </DetailBox>
                <DetailBox title="Document info">
                  <DetailRow label="PO No" value={detail.order_number} />
                  <DetailRow label="Status" value={<StatusBadge status={detail.status} />} />
                  <DetailRow
                    label="Prepared by"
                    value={detail.created_by_username ?? "—"}
                  />
                </DetailBox>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <DetailBox title="Supplier details">
                  <DetailRow label="TIN" value={detail.supplier_vat_number ?? "—"} />
                  <DetailRow label="Name" value={detail.supplier_name} />
                  <DetailRow label="Address" value={detail.supplier_address ?? "—"} />
                  <DetailRow
                    label="Telephone"
                    value={detail.supplier_telephone ?? "—"}
                  />
                </DetailBox>
                <DetailBox title="Purchaser details">
                  <DetailRow label="TIN" value={company.tin || "—"} />
                  <DetailRow label="Name" value={company.name} />
                  <DetailRow label="Address" value={company.address} />
                  <DetailRow label="Telephone" value={company.telephone || "—"} />
                </DetailBox>
              </div>

              <DetailBox title="Delivery & additional information">
                <DetailRow label="Date of delivery" value="—" />
                <DetailRow label="Place of supply" value="—" />
                <DetailRow label="Additional info" value={detail.notes ?? "—"} />
              </DetailBox>

              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Ref.</TableHead>
                      <TableHead>Description of goods or services</TableHead>
                      <TableHead className="min-w-[180px]">Supplier warranties</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
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
                          colSpan={7}
                          className="h-16 text-center text-muted-foreground"
                        >
                          No lines on this purchase order.
                        </TableCell>
                      </TableRow>
                    ) : (
                      detail.lines.map((line, idx) => {
                        const qty = num(line.qty_ordered);
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
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmtRs(num(line.qty_received))}
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
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Total amount including VAT
                    </span>
                    <span className="tabular-nums font-medium">
                      {fmtRs(totals.totalIncVat)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Delivery charges</span>
                    <span className="tabular-nums">{fmtRs(totals.deliveryCharges)}</span>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                    <span>Total amount including delivery charges</span>
                    <span className="tabular-nums">{fmtRs(totals.grandTotal)}</span>
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  Payment communication: {detail.order_number}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Please supply goods as per this purchase order.</li>
                  <li>
                    Delivery must be accompanied by a delivery note and supplier
                    invoice.
                  </li>
                  <li>
                    Any variation in price or quantity must be approved in writing
                    before supply.
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
