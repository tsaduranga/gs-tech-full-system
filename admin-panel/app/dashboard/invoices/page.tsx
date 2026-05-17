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
import { SearchableStrPicker } from "@/components/searchable-str-picker";

type CustomerBrief = { id: number; name: string };

type ItemBrief = { id: number; sku: string; name: string };

type OpenInvoiceBrief = {
  id: number;
  invoice_number: string;
  customer_name: string;
  balance_due: number | string;
  total: number | string;
};

type LineDraft = {
  key: string;
  itemId: number;
  qty: string;
  unitPrice: string;
};

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH", label: "CASH" },
  { value: "CARD", label: "CARD" },
  { value: "BANK", label: "BANK" },
  { value: "OTHER", label: "OTHER" },
] as const;

function newLine(): LineDraft {
  const key =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `line-${Math.random().toString(36).slice(2)}`;
  return {
    key,
    itemId: 0,
    qty: "",
    unitPrice: "",
  };
}

function parseMoneyField(t: string): number {
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

export default function InvoicesPage() {
  const [customerId, setCustomerId] = useState(0);
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()]);
  const [createMsg, setCreateMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [paymentInvoiceId, setPaymentInvoiceId] = useState(0);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [paymentMsg, setPaymentMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const [customersLoading, setCustomersLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [openInvLoading, setOpenInvLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [items, setItems] = useState<ItemBrief[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenInvoiceBrief[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      setCustomersLoading(true);
      setItemsLoading(true);
      setOpenInvLoading(true);
      const [custRes, itRes, openRes] = await Promise.all([
        apiJson<{ items: CustomerBrief[] }>("/customers?page=1&pageSize=500"),
        apiJson<{ items: ItemBrief[] }>("/items?page=1&pageSize=500"),
        apiJson<{
          items: OpenInvoiceBrief[];
        }>("/invoices?page=1&pageSize=500&has_balance=1"),
      ]);
      if (cancelled) return;
      if (custRes.ok && Array.isArray(custRes.data?.items))
        setCustomers(custRes.data.items);
      else setCustomers([]);
      if (itRes.ok && Array.isArray(itRes.data?.items))
        setItems(itRes.data.items);
      else setItems([]);
      if (openRes.ok && Array.isArray(openRes.data?.items))
        setOpenInvoices(openRes.data.items);
      else setOpenInvoices([]);
      setCustomersLoading(false);
      setItemsLoading(false);
      setOpenInvLoading(false);
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

  const invoicePickerOptions = useMemo(
    () =>
      openInvoices.map((inv) => ({
        value: inv.id,
        label: `${inv.invoice_number} — ${inv.customer_name} — due ${moneyDisplay(inv.balance_due)}`,
      })),
    [openInvoices]
  );

  const selectedOpenInvoice = useMemo(
    () =>
      paymentInvoiceId > 0
        ? openInvoices.find((x) => x.id === paymentInvoiceId) ?? null
        : null,
    [openInvoices, paymentInvoiceId]
  );

  async function reloadOpenInvoices() {
    setOpenInvLoading(true);
    const openRes = await apiJson<{
      items: OpenInvoiceBrief[];
    }>("/invoices?page=1&pageSize=500&has_balance=1");
    setOpenInvLoading(false);
    if (openRes.ok && Array.isArray(openRes.data?.items))
      setOpenInvoices(openRes.data.items);
  }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setCreateMsg(null);
    if (customerId < 1) {
      setCreateMsg("Pick a customer.");
      return;
    }
    const parsedLines: { item_id: number; qty: number; unit_price: number }[] =
      [];

    for (const row of lines) {
      if (row.itemId < 1) continue;
      const q = parseMoneyField(row.qty);
      const p = parseMoneyField(row.unitPrice);
      if (!Number.isFinite(q) || q <= 0) {
        setCreateMsg("Each line with an item needs a quantity greater than zero.");
        return;
      }
      if (!Number.isFinite(p) || p < 0) {
        setCreateMsg("Each line needs a unit price zero or greater.");
        return;
      }
      parsedLines.push({
        item_id: row.itemId,
        qty: q,
        unit_price: p,
      });
    }

    if (parsedLines.length < 1) {
      setCreateMsg("Add at least one line with an item.");
      return;
    }

    setCreating(true);
    const res = await apiJson<{ id: number }>("/invoices", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        repair_job_id: null,
        lines: parsedLines,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      setCreateMsg(res.error ?? "Failed to create invoice");
      return;
    }
    setCreateMsg(`Invoice created (id ${res.data?.id ?? "—"})`);
    setCustomerId(0);
    setLines([newLine()]);
    void reloadOpenInvoices();
  }

  async function addPayment(e: React.FormEvent) {
    e.preventDefault();
    setPaymentMsg(null);
    if (paymentInvoiceId < 1) {
      setPaymentMsg("Pick an invoice with an open balance.");
      return;
    }
    const amt = parseMoneyField(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setPaymentMsg("Enter a payment amount greater than zero.");
      return;
    }

    setPaying(true);
    const res = await apiJson(`/invoices/${paymentInvoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify({
        amount: amt,
        payment_method: method,
      }),
    });
    setPaying(false);
    setPaymentMsg(
      res.ok ? "Payment recorded." : res.error ?? "Payment failed."
    );
    if (res.ok) {
      setAmount("");
      setPaymentInvoiceId(0);
      void reloadOpenInvoices();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>New invoice</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose a customer and add line items with quantities and prices.{" "}
            <Link
              href="/dashboard/invoice-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Invoice history
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvoice} className="flex flex-col gap-8">
            <div className="min-w-0 space-y-2 sm:max-w-xl">
              <Label htmlFor="inv-customer">Customer</Label>
              <CatalogIdCombobox
                id="inv-customer"
                items={customers.map((c) => ({
                  id: c.id,
                  name: `${c.name} (${c.id})`,
                }))}
                valueId={customerId}
                onValueChange={setCustomerId}
                placeholder="Search customer…"
                loading={customersLoading}
                emptyListHint="No customers"
                emptyFilterHint="No matching customers"
                variant="underline"
              />
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
                      <th className="px-3 py-2 text-left font-medium">Item</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Quantity
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Unit price
                      </th>
                      <th className="w-px px-3 py-2" aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((row, idx) => (
                      <tr key={row.key} className="border-b border-border/60">
                        <td className="px-3 py-2 align-middle">
                          <SearchableNumPicker
                            id={`inv-line-it-${idx}`}
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
                            aria-label="Quantity"
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
                            placeholder="e.g. 1"
                            className={underlineInputClass}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <Input
                            aria-label="Unit price"
                            inputMode="decimal"
                            value={row.unitPrice}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines((prev) =>
                                prev.map((l) =>
                                  l.key === row.key
                                    ? { ...l, unitPrice: v }
                                    : l
                                )
                              );
                            }}
                            placeholder="e.g. 50"
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
                disabled={creating}
                className="inline-flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </Button>
              {createMsg ? (
                <p
                  className={cn(
                    "text-sm",
                    /^Invoice created/i.test(createMsg)
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
                  role="status"
                >
                  {createMsg}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>Record payment</CardTitle>
          <p className="text-sm text-muted-foreground">
            Invoices listed here still have a balance due. After full payment,
            stock is reduced from the default active warehouse.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={addPayment} className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="min-w-0 space-y-2 sm:col-span-2">
                <Label htmlFor="inv-pay-inv">Invoice</Label>
                <SearchableNumPicker
                  id="inv-pay-inv"
                  options={invoicePickerOptions}
                  valueId={paymentInvoiceId}
                  onValueChange={setPaymentInvoiceId}
                  placeholder={
                    openInvLoading
                      ? "Loading open invoices…"
                      : invoicePickerOptions.length === 0
                        ? "No open balances"
                        : "Search invoice…"
                  }
                  loading={openInvLoading}
                  emptyListHint="No invoices with balance"
                  emptyFilterHint="No matches"
                  variant="underline"
                />
                {selectedOpenInvoice ? (
                  <p className="text-xs text-muted-foreground">
                    Balance due:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {moneyDisplay(selectedOpenInvoice.balance_due)}
                    </span>
                    {" · "}Total{" "}
                    <span className="tabular-nums">
                      {moneyDisplay(selectedOpenInvoice.total)}
                    </span>
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="inv-pay-amt">Amount</Label>
                <Input
                  id="inv-pay-amt"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min={0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className={underlineInputClass}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="inv-pay-method">Method</Label>
                <SearchableStrPicker
                  id="inv-pay-method"
                  options={[...PAYMENT_METHOD_OPTIONS]}
                  value={method}
                  onValueChange={(v) => setMethod(v || "CASH")}
                  placeholder="Payment method"
                  allowClear={false}
                />
              </div>
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={paying || invoicePickerOptions.length === 0}
              className="inline-flex max-w-xl items-center gap-2"
            >
              {paying ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit payment"
              )}
            </Button>
            {paymentMsg ? (
              <p
                className={cn(
                  "text-sm",
                  paymentMsg === "Payment recorded."
                    ? "text-muted-foreground"
                    : "text-destructive"
                )}
                role="status"
              >
                {paymentMsg}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
