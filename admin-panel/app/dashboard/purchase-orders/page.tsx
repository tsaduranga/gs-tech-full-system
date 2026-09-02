"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import { useRouteAccess } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { ItemStockHoverInfo } from "@/components/item-stock-hover-info";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import { SearchableMultiNumPicker } from "@/components/searchable-multi-num-picker";
import { formatWarrantyDisplay } from "@/lib/warranty-format";
import {
  DEFAULT_ITEM_TAX_RATES,
  formatTaxPercent,
  taxRatesFromApi,
} from "@/lib/item-pricing";
import {
  documentTotals,
  fmtRs,
  lineAmountExVat,
} from "@/lib/document-totals";

type SupplierBrief = { id: number; name: string };

type ItemBrief = {
  id: number;
  sku: string;
  name: string;
  unit_cost: number;
  supplier_warranty_ids?: number[];
};

type WarrantyPickerRow = {
  id: number;
  name: string;
  warranty_years: number;
  warranty_months: number;
};

type LineDraft = {
  key: string;
  itemId: number;
  qty: string;
  unitCost: string;
  supplierWarrantyIds: number[];
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
    supplierWarrantyIds: [],
  };
}

function parseMoneyField(t: string): number {
  const n = Number(String(t).trim().replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

type LineFieldErrors = {
  item?: string;
  qty?: string;
  unitCost?: string;
};

type FormErrors = {
  supplier?: string;
  orderedAt?: string;
  linesGeneral?: string;
  deliveryCharges?: string;
  lines: Record<string, LineFieldErrors>;
};

const emptyFormErrors = (): FormErrors => ({ lines: {} });

function fieldErrorCls() {
  return "text-xs text-destructive";
}

function validatePurchaseOrderForm(
  supplierId: number,
  orderedAt: string,
  lines: LineDraft[],
  deliveryCharges: string
): FormErrors | null {
  const errors: FormErrors = { lines: {} };
  let hasError = false;

  if (supplierId < 1) {
    errors.supplier = "Supplier is required";
    hasError = true;
  }

  if (!orderedAt.trim()) {
    errors.orderedAt = "Order date is required";
    hasError = true;
  }

  const delivery = parseMoneyField(deliveryCharges);
  if (
    deliveryCharges.trim() !== "" &&
    (!Number.isFinite(delivery) || delivery < 0)
  ) {
    errors.deliveryCharges = "Enter a valid amount (0 or greater)";
    hasError = true;
  }

  let validLineCount = 0;
  for (const row of lines) {
    const rowErr: LineFieldErrors = {};
    const qty = parseMoneyField(row.qty);
    const unit = parseMoneyField(row.unitCost);
    const hasItem = row.itemId > 0;
    const hasQty = row.qty.trim() !== "";
    const hasUnit = row.unitCost.trim() !== "";
    const rowTouched = hasItem || hasQty || hasUnit;

    if (hasItem) {
      if (!hasQty || !Number.isFinite(qty) || qty <= 0) {
        rowErr.qty = hasQty ? "Must be greater than zero" : "Quantity is required";
        hasError = true;
      }
      if (!hasUnit || !Number.isFinite(unit) || unit < 0) {
        rowErr.unitCost = hasUnit
          ? "Must be zero or greater"
          : "Unit price is required";
        hasError = true;
      }
      if (Object.keys(rowErr).length === 0) validLineCount++;
    } else if (rowTouched) {
      rowErr.item = "Item is required";
      if (hasQty && (!Number.isFinite(qty) || qty <= 0)) {
        rowErr.qty = "Must be greater than zero";
        hasError = true;
      }
      if (hasUnit && (!Number.isFinite(unit) || unit < 0)) {
        rowErr.unitCost = "Must be zero or greater";
        hasError = true;
      }
      hasError = true;
    }

    if (Object.keys(rowErr).length > 0) {
      errors.lines[row.key] = rowErr;
    }
  }

  if (validLineCount < 1) {
    errors.linesGeneral = "Add at least one item with quantity and unit price";
    hasError = true;
    if (lines.length === 1) {
      const first = lines[0];
      errors.lines[first.key] = {
        ...errors.lines[first.key],
        item: errors.lines[first.key]?.item ?? "Item is required",
      };
    }
  }

  return hasError ? errors : null;
}

function invalidUnderlineClass(invalid: boolean) {
  return invalid ? "border-destructive focus-visible:border-destructive" : "";
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
  const [errors, setErrors] = useState<FormErrors>(emptyFormErrors);
  const [submitting, setSubmitting] = useState(false);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [items, setItems] = useState<ItemBrief[]>([]);
  const [supplierWarrantyOptions, setSupplierWarrantyOptions] = useState<
    { value: number; label: string }[]
  >([]);
  const [warrantyPickerLoading, setWarrantyPickerLoading] = useState(true);
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [vatRate, setVatRate] = useState(DEFAULT_ITEM_TAX_RATES.vatRate);
  const { canEdit } = useRouteAccess();

  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      setSuppliersLoading(true);
      setItemsLoading(true);
      const [supRes, itRes, settingsRes, warrantyRes] = await Promise.all([
        apiJson<{ items: SupplierBrief[] }>(
          "/suppliers?page=1&pageSize=500"
        ),
        apiJson<{ items: ItemBrief[] }>("/items?page=1&pageSize=500"),
        apiJson<{ vat_rate: number }>("/settings"),
        apiJson<WarrantyPickerRow[]>("/warranties/picker?type=supplier"),
      ]);
      if (cancelled) return;
      if (supRes.ok && Array.isArray(supRes.data?.items))
        setSuppliers(supRes.data.items);
      else setSuppliers([]);
      if (itRes.ok && Array.isArray(itRes.data?.items))
        setItems(itRes.data.items);
      else setItems([]);
      if (settingsRes.ok && settingsRes.data) {
        setVatRate(taxRatesFromApi(settingsRes.data).vatRate);
      }
      if (warrantyRes.ok && Array.isArray(warrantyRes.data)) {
        setSupplierWarrantyOptions(
          warrantyRes.data.map((w) => ({
            value: w.id,
            label: formatWarrantyDisplay(w.name, w.warranty_years, w.warranty_months),
          }))
        );
      } else {
        setSupplierWarrantyOptions([]);
      }
      setSuppliersLoading(false);
      setItemsLoading(false);
      setWarrantyPickerLoading(false);
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

  const computedLines = useMemo(() => {
    return lines
      .map((row) => {
        if (row.itemId < 1) return null;
        const qty = parseMoneyField(row.qty);
        const unitExVat = parseMoneyField(row.unitCost);
        if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(unitExVat) || unitExVat < 0) {
          return null;
        }
        return { qty, unitExVat };
      })
      .filter((line): line is { qty: number; unitExVat: number } => line != null);
  }, [lines]);

  const totals = useMemo(
    () =>
      documentTotals(
        computedLines,
        vatRate,
        parseMoneyField(deliveryCharges) || 0
      ),
    [computedLines, vatRate, deliveryCharges]
  );

  const vatPercentLabel = formatTaxPercent(vatRate);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const validationErrors = validatePurchaseOrderForm(
      supplierId,
      orderedAt,
      lines,
      deliveryCharges
    );
    if (validationErrors) {
      setErrors(validationErrors);
      setMsg("Please fix the highlighted fields.");
      return;
    }
    setErrors(emptyFormErrors());

    const parsedLines: {
      item_id: number;
      qty_ordered: number;
      unit_cost: number;
      supplier_warranty_ids: number[];
    }[] = [];

    for (const row of lines) {
      if (row.itemId < 1) continue;
      const q = parseMoneyField(row.qty);
      const c = parseMoneyField(row.unitCost);
      parsedLines.push({
        item_id: row.itemId,
        qty_ordered: q,
        unit_cost: c,
        supplier_warranty_ids: row.supplierWarrantyIds,
      });
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
    setDeliveryCharges("0");
    setErrors(emptyFormErrors());
  }

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-muted-foreground">
            You have view-only access for this module.
          </p>
          <Link
            href="/dashboard/purchase-order-history"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Purchase order history
          </Link>
        </CardContent>
      </Card>
    );
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
                <Label htmlFor="po-supplier">
                  Supplier<span className="text-destructive">*</span>
                </Label>
                <CatalogIdCombobox
                  id="po-supplier"
                  items={suppliers.map((s) => ({
                    id: s.id,
                    name: `${s.name} (${s.id})`,
                  }))}
                  valueId={supplierId}
                  onValueChange={(id) => {
                    setSupplierId(id);
                    setErrors((prev) => ({ ...prev, supplier: undefined }));
                    setMsg(null);
                  }}
                  placeholder="Search supplier…"
                  loading={suppliersLoading}
                  emptyListHint="No suppliers"
                  emptyFilterHint="No matching suppliers"
                  variant="underline"
                  invalid={Boolean(errors.supplier)}
                />
                {errors.supplier ? (
                  <p className={fieldErrorCls()} role="alert">
                    {errors.supplier}
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="po-date">
                  Ordered at<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="po-date"
                  type="date"
                  value={orderedAt}
                  onChange={(e) => {
                    setOrderedAt(e.target.value);
                    setErrors((prev) => ({ ...prev, orderedAt: undefined }));
                    setMsg(null);
                  }}
                  className={cn(
                    underlineInputClass,
                    invalidUnderlineClass(Boolean(errors.orderedAt))
                  )}
                  aria-invalid={Boolean(errors.orderedAt)}
                  required
                />
                {errors.orderedAt ? (
                  <p className={fieldErrorCls()} role="alert">
                    {errors.orderedAt}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <Label className="text-base font-medium">
                    Items<span className="text-destructive">*</span>
                  </Label>
                  {errors.linesGeneral ? (
                    <p className={cn(fieldErrorCls(), "mt-1")} role="alert">
                      {errors.linesGeneral}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Assign one or more supplier warranties per line. Defaults
                      come from the item master when you pick an item.
                    </p>
                  )}
                </div>
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

              <div className="-mx-1 overflow-x-auto rounded-md border border-border">
                <table className="w-full min-w-[1120px] table-fixed text-sm">
                  <thead className="border-b bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="w-12 px-2 py-2 text-left font-medium">Ref.</th>
                      <th className="w-[28%] px-3 py-2 text-left font-medium">
                        Description of goods or services
                      </th>
                      <th className="w-[22%] px-3 py-2 text-left font-medium">
                        Supplier warranties
                      </th>
                      <th className="w-20 px-3 py-2 text-right font-medium">Qty</th>
                      <th className="w-28 px-3 py-2 text-right font-medium">
                        Unit price
                      </th>
                      <th className="w-32 px-3 py-2 text-right font-medium">
                        Amount excl. VAT (Rs.)
                      </th>
                      <th className="w-12 px-2 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row, idx) => {
                      const item = row.itemId > 0 ? itemsById.get(row.itemId) : undefined;
                      const qty = parseMoneyField(row.qty);
                      const unitExVat = parseMoneyField(row.unitCost);
                      const rowErrors = errors.lines[row.key];
                      const lineTotal =
                        row.itemId > 0 &&
                        Number.isFinite(qty) &&
                        qty > 0 &&
                        Number.isFinite(unitExVat) &&
                        unitExVat >= 0
                          ? lineAmountExVat(qty, unitExVat)
                          : null;

                      return (
                      <tr key={row.key} className="border-b border-border/60">
                        <td className="px-2 py-2 align-middle text-muted-foreground tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="min-w-0 px-3 py-2 align-middle">
                          <div className="flex items-start gap-1">
                            <div className="min-w-0 flex-1">
                              <SearchableNumPicker
                                id={`po-line-it-${idx}`}
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
                                          qty: "",
                                          unitCost: "",
                                          supplierWarrantyIds: [],
                                        };
                                      }
                                      const picked = itemsById.get(id);
                                      const cost = Number(picked?.unit_cost ?? 0);
                                      const defaultWarrantyIds = Array.isArray(
                                        picked?.supplier_warranty_ids
                                      )
                                        ? picked.supplier_warranty_ids
                                        : [];
                                      return {
                                        ...l,
                                        itemId: id,
                                        qty: "1",
                                        unitCost:
                                          Number.isFinite(cost) && cost >= 0
                                            ? String(cost)
                                            : "",
                                        supplierWarrantyIds: defaultWarrantyIds,
                                      };
                                    })
                                  );
                                  setErrors((prev) => {
                                    const nextLines = { ...prev.lines };
                                    const rowErr = { ...nextLines[row.key] };
                                    delete rowErr.item;
                                    if (Object.keys(rowErr).length === 0) {
                                      delete nextLines[row.key];
                                    } else {
                                      nextLines[row.key] = rowErr;
                                    }
                                    return {
                                      ...prev,
                                      lines: nextLines,
                                      linesGeneral: undefined,
                                    };
                                  });
                                  setMsg(null);
                                }}
                                placeholder="Search item…"
                                loading={itemsLoading}
                                emptyListHint="No items"
                                emptyFilterHint="No matching items"
                                variant="underline"
                                invalid={Boolean(rowErrors?.item)}
                              />
                              {rowErrors?.item ? (
                                <p className={cn(fieldErrorCls(), "mt-1")} role="alert">
                                  {rowErrors.item}
                                </p>
                              ) : null}
                              {item ? (
                                <p className="mt-1 truncate text-xs text-muted-foreground">
                                  {item.name}
                                </p>
                              ) : null}
                            </div>
                            {row.itemId > 0 ? (
                              <ItemStockHoverInfo itemId={row.itemId} />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <SearchableMultiNumPicker
                            id={`po-line-sw-${idx}`}
                            options={supplierWarrantyOptions}
                            valueIds={row.supplierWarrantyIds}
                            onValueChange={(ids) => {
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? { ...l, supplierWarrantyIds: ids }
                                    : l
                                )
                              );
                              setMsg(null);
                            }}
                            disabled={row.itemId < 1}
                            loading={warrantyPickerLoading}
                            placeholder="Search supplier warranties…"
                            emptyListHint="No supplier warranties"
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            aria-label="Quantity ordered"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
                            value={row.qty}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key ? { ...l, qty: v } : l
                                )
                              );
                              setErrors((prev) => {
                                const nextLines = { ...prev.lines };
                                const rowErr = { ...nextLines[row.key] };
                                delete rowErr.qty;
                                if (Object.keys(rowErr).length === 0) {
                                  delete nextLines[row.key];
                                } else {
                                  nextLines[row.key] = rowErr;
                                }
                                return {
                                  ...prev,
                                  lines: nextLines,
                                  linesGeneral: undefined,
                                };
                              });
                              setMsg(null);
                            }}
                            placeholder="e.g. 10"
                            aria-invalid={Boolean(rowErrors?.qty)}
                            className={cn(
                              underlineInputClass,
                              "text-right tabular-nums",
                              invalidUnderlineClass(Boolean(rowErrors?.qty))
                            )}
                          />
                          {rowErrors?.qty ? (
                            <p className={cn(fieldErrorCls(), "mt-1 text-right")} role="alert">
                              {rowErrors.qty}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Input
                            aria-label="Unit cost excluding VAT"
                            type="number"
                            inputMode="decimal"
                            step="any"
                            min={0}
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
                              setErrors((prev) => {
                                const nextLines = { ...prev.lines };
                                const rowErr = { ...nextLines[row.key] };
                                delete rowErr.unitCost;
                                if (Object.keys(rowErr).length === 0) {
                                  delete nextLines[row.key];
                                } else {
                                  nextLines[row.key] = rowErr;
                                }
                                return {
                                  ...prev,
                                  lines: nextLines,
                                  linesGeneral: undefined,
                                };
                              });
                              setMsg(null);
                            }}
                            placeholder="e.g. 5"
                            aria-invalid={Boolean(rowErrors?.unitCost)}
                            className={cn(
                              underlineInputClass,
                              "text-right tabular-nums",
                              invalidUnderlineClass(Boolean(rowErrors?.unitCost))
                            )}
                          />
                          {rowErrors?.unitCost ? (
                            <p className={cn(fieldErrorCls(), "mt-1 text-right")} role="alert">
                              {rowErrors.unitCost}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 align-middle text-right tabular-nums text-muted-foreground">
                          {lineTotal != null ? fmtRs(lineTotal) : "—"}
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
                    );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/20">
                      <td colSpan={5} className="px-3 py-2 text-right font-medium">
                        Total value of supply
                      </td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">
                        {fmtRs(totals.totalExVat)}
                      </td>
                      <td />
                    </tr>
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">
                        VAT amount (total value of supply @ {vatPercentLabel}%)
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {fmtRs(totals.vatAmount)}
                      </td>
                      <td />
                    </tr>
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold">
                        Total amount including VAT
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {fmtRs(totals.totalIncVat)}
                      </td>
                      <td />
                    </tr>
                    <tr className="bg-muted/20">
                      <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">
                        Delivery charges
                      </td>
                      <td className="px-3 py-2 align-top">
                        <Input
                          aria-label="Delivery charges"
                          type="number"
                          inputMode="decimal"
                          step="any"
                          min={0}
                          value={deliveryCharges}
                          onChange={(e) => {
                            setDeliveryCharges(e.target.value);
                            setErrors((prev) => ({
                              ...prev,
                              deliveryCharges: undefined,
                            }));
                            setMsg(null);
                          }}
                          placeholder="0"
                          aria-invalid={Boolean(errors.deliveryCharges)}
                          className={cn(
                            underlineInputClass,
                            "text-right tabular-nums",
                            invalidUnderlineClass(Boolean(errors.deliveryCharges))
                          )}
                        />
                        {errors.deliveryCharges ? (
                          <p className={cn(fieldErrorCls(), "mt-1 text-right")} role="alert">
                            {errors.deliveryCharges}
                          </p>
                        ) : null}
                      </td>
                      <td />
                    </tr>
                    <tr className="border-t border-border bg-muted/30">
                      <td colSpan={5} className="px-3 py-2 text-right font-semibold">
                        Total amount including delivery charges
                      </td>
                      <td className="px-3 py-2 text-right text-base font-semibold tabular-nums">
                        {fmtRs(totals.grandTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
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
