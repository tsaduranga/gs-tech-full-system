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
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import { SearchableStrPicker } from "@/components/searchable-str-picker";

type Row = {
  id: number;
  customer_id: number;
  customer_name: string;
  order_number: string;
  status: string;
  order_date: string;
  subtotal: number | string;
  tax: number | string;
  total: number | string;
  invoice_id: number | null;
  updated_at: string;
  created_by_username: string | null;
};

type ListResponse = { items: Row[]; total: number; page: number; pageSize: number };

type CustomerBrief = { id: number; name: string };

const PAGE_OPTIONS = [5, 10, 25, 50];

const STATUS_OPTS = [
  { value: "OPEN", label: "OPEN" },
  { value: "FULFILLED", label: "FULFILLED" },
  { value: "CANCELLED", label: "CANCELLED" },
  { value: "DRAFT", label: "DRAFT" },
];

function moneyDisplay(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function SalesOrderHistoryPage() {
  const [list, setList] = useState<Row[]>([]);
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

  useEffect(() => {
    async function meta() {
      setMetaLoading(true);
      const r = await apiJson<{ items: CustomerBrief[] }>(
        "/customers?page=1&pageSize=500"
      );
      setCustomers(r.ok && Array.isArray(r.data?.items) ? r.data.items : []);
      setMetaLoading(false);
    }
    void meta();
  }, []);

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
    const res = await apiJson<ListResponse>(`/sales-orders?${qs}`, {});
    setListLoading(false);
    if (!res.ok || !Array.isArray(res.data?.items)) {
      setListError(res.error ?? "Failed to load sales orders");
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

  return (
    <Card className="w-full border-border/80">
      <CardHeader>
        <CardTitle>Sales order history</CardTitle>
        <CardDescription>
          Orders before invoicing — search and filter here.{" "}
          <Link
            href="/dashboard/sales-orders"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Create a sales order
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="soh-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="soh-q"
                placeholder="Customer, order #, id…"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (setPage(1), setActiveQuery(filterInput.trim()))}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPage(1);
                  setActiveQuery(filterInput.trim());
                }}
              >
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[220px] flex-col gap-2">
            <Label>Customer</Label>
            <CatalogIdCombobox
              id="soh-cust"
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
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label>Status</Label>
            <SearchableStrPicker
              id="soh-st"
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
            <Label>Rows</Label>
            <SearchableNumPicker
              id="soh-ps"
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
          <p className="text-sm text-destructive">{listError}</p>
        ) : null}
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[64px]">Id</TableHead>
                <TableHead className="font-mono">Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No sales orders found.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">{row.id}</TableCell>
                    <TableCell className="font-mono text-xs">{row.order_number}</TableCell>
                    <TableCell>
                      {row.customer_name}
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({row.customer_id})
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {moneyDisplay(row.total)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {String(row.order_date).slice(0, 10)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.invoice_id ? `#${row.invoice_id}` : "—"}
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
