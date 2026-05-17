"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import { SearchableStrPicker } from "@/components/searchable-str-picker";

type InvoiceRow = {
  id: number;
  customer_id: number;
  customer_name: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  amount_paid: number | string;
  balance_due: number | string;
  created_at: string;
  updated_at: string;
  created_by_username: string | null;
};

type InvoiceListResponse = {
  items: InvoiceRow[];
  total: number;
  page: number;
  pageSize: number;
};

type CustomerBrief = { id: number; name: string };

const PAGE_OPTIONS = [5, 10, 25, 50];

const STATUS_OPTS = [
  { value: "DRAFT", label: "DRAFT" },
  { value: "PENDING", label: "PENDING" },
  { value: "PARTIAL_PAID", label: "PARTIAL_PAID" },
  { value: "PAID", label: "PAID" },
  { value: "VOID", label: "VOID" },
];

function moneyDisplay(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return String(iso);
  }
}

function statusTone(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "PARTIAL_PAID":
      return "bg-amber-500/15 text-amber-800 dark:text-amber-300";
    case "PENDING":
      return "bg-sky-500/15 text-sky-900 dark:text-sky-300";
    case "VOID":
      return "bg-destructive/15 text-destructive";
    case "DRAFT":
      return "bg-zinc-500/15 text-foreground";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export default function InvoiceHistoryPage() {
  const [list, setList] = useState<InvoiceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [customerFilterId, setCustomerFilterId] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const pageSizeOptions = useMemo(
    () => PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    []
  );

  const loadCustomers = useCallback(async () => {
    setMetaLoading(true);
    const custRes = await apiJson<{ items: CustomerBrief[] }>(
      "/customers?page=1&pageSize=500"
    );
    if (custRes.ok && Array.isArray(custRes.data?.items))
      setCustomers(custRes.data.items);
    else setCustomers([]);
    setMetaLoading(false);
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (customerFilterId > 0) qs.set("customer_id", String(customerFilterId));
    if (statusFilter.trim()) qs.set("status", statusFilter.trim());

    const res = await apiJson<InvoiceListResponse>(
      `/invoices?${qs.toString()}`,
      {}
    );
    setListLoading(false);
    if (!res.ok || !Array.isArray(res.data?.items)) {
      setListError(res.error ?? "Failed to load invoices");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery, customerFilterId, statusFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function applyListSearch() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  return (
    <Card className="w-full border-border/80">
      <CardHeader>
        <CardTitle>Invoice history</CardTitle>
        <CardDescription>
          Search by customer, invoice number, or id. Filter by customer and
          status.{" "}
          <Link
            href="/dashboard/invoices"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create a new invoice or record a payment
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="invh-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="invh-q"
                placeholder="Customer name, invoice #, invoice id…"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyListSearch()}
              />
              <Button type="button" variant="outline" onClick={applyListSearch}>
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[220px] flex-col gap-2">
            <Label htmlFor="invh-cust">Customer</Label>
            <CatalogIdCombobox
              id="invh-cust"
              items={customers.map((c) => ({
                id: c.id,
                name: `${c.name} (${c.id})`,
              }))}
              valueId={customerFilterId}
              onValueChange={(id) => {
                setCustomerFilterId(id);
                setPage(1);
              }}
              placeholder="All customers"
              loading={metaLoading}
              emptyListHint="No customers"
              emptyFilterHint="No matches"
            />
          </div>
          <div className="flex min-w-[160px] flex-col gap-2">
            <Label htmlFor="invh-st">Status</Label>
            <SearchableStrPicker
              id="invh-st"
              options={STATUS_OPTS}
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v.trim().toUpperCase());
                setPage(1);
              }}
              placeholder="All statuses"
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="invh-ps">Rows per page</Label>
            <SearchableNumPicker
              id="invh-ps"
              options={pageSizeOptions}
              valueId={pageSize}
              onValueChange={(id) => {
                if (!PAGE_OPTIONS.includes(id)) return;
                setPageSize(id);
                setPage(1);
              }}
              placeholder="Rows"
            />
          </div>
        </div>

        {listError ? (
          <p className="text-sm text-destructive" role="alert">
            {listError}
          </p>
        ) : null}

        <div className="relative overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Id</TableHead>
                <TableHead className="font-mono">Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="whitespace-nowrap">Invoice date</TableHead>
                <TableHead className="whitespace-nowrap">Updated</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No invoices match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">{row.id}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {row.invoice_number}
                    </TableCell>
                    <TableCell>
                      <span className="truncate">{row.customer_name}</span>
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({row.customer_id})
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          statusTone(row.status)
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {moneyDisplay(row.total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {moneyDisplay(row.amount_paid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {moneyDisplay(row.balance_due)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {fmtDateShort(row.invoice_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {fmtDateShort(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.created_by_username ?? "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? "No results"
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || listLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm tabular-nums text-muted-foreground">
              Page {page} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || listLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
