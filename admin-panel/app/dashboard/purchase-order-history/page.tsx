"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon, SearchIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

type PORow = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  order_number: string;
  status: string;
  ordered_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  created_by_username: string | null;
};

type ListResponse = {
  items: PORow[];
  total: number;
  page: number;
  pageSize: number;
};

type SupplierBrief = { id: number; name: string };

const PAGE_OPTIONS = [5, 10, 25, 50];

const STATUS_OPTIONS = [
  { value: "OPEN", label: "OPEN" },
  { value: "PARTIAL", label: "PARTIAL" },
  { value: "CLOSED", label: "CLOSED" },
  { value: "DRAFT", label: "DRAFT" },
];

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

export default function PurchaseOrderHistoryPage() {
  const [list, setList] = useState<PORow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [supplierFilterId, setSupplierFilterId] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const pageSizeOptions = useMemo(
    () => PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    []
  );

  const loadSuppliers = useCallback(async () => {
    setSuppliersLoading(true);
    const res = await apiJson<{ items: SupplierBrief[] }>(
      "/suppliers?page=1&pageSize=500"
    );
    if (res.ok && Array.isArray(res.data?.items)) setSuppliers(res.data.items);
    else setSuppliers([]);
    setSuppliersLoading(false);
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (supplierFilterId > 0) qs.set("supplier_id", String(supplierFilterId));
    if (statusFilter.trim()) qs.set("status", statusFilter.trim());

    const res = await apiJson<ListResponse>(
      `/purchase-orders?${qs.toString()}`,
      {}
    );
    setLoading(false);
    if (!res.ok || !Array.isArray(res.data?.items)) {
      setError(res.error ?? "Failed to load purchase orders");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery, supplierFilterId, statusFilter]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function applySearch() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Purchase order history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Search by PO number, supplier, or id; filter by supplier and status.
          <Link
            href="/dashboard/purchase-orders"
            className="ml-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            Create a new PO
          </Link>
          .
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="poh-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="poh-q"
                placeholder="Order #, supplier, PO id, supplier id…"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
              />
              <Button type="button" variant="outline" onClick={applySearch}>
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[220px] flex-col gap-2">
            <Label htmlFor="poh-sup">Supplier</Label>
            <CatalogIdCombobox
              id="poh-sup"
              items={suppliers.map((s) => ({
                id: s.id,
                name: `${s.name} (${s.id})`,
              }))}
              valueId={supplierFilterId}
              onValueChange={(id) => {
                setSupplierFilterId(id);
                setPage(1);
              }}
              placeholder="All suppliers"
              loading={suppliersLoading}
              emptyListHint="No suppliers"
              emptyFilterHint="No matching suppliers"
            />
          </div>
          <div className="flex min-w-[160px] flex-col gap-2">
            <Label htmlFor="poh-st">Status</Label>
            <SearchableStrPicker
              id="poh-st"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v.trim().toUpperCase());
                setPage(1);
              }}
              placeholder="All statuses"
              emptyFilterHint="No matching statuses"
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="poh-ps">Rows per page</Label>
            <SearchableNumPicker
              id="poh-ps"
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

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="relative overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[72px]">Id</TableHead>
                <TableHead className="font-mono">Order #</TableHead>
                <TableHead className="min-w-[120px]">Supplier</TableHead>
                <TableHead className="w-[88px]">Status</TableHead>
                <TableHead>Ordered</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="min-w-[88px]">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No purchase orders match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">{row.id}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {row.order_number}
                    </TableCell>
                    <TableCell>
                      <span className="truncate">{row.supplier_name}</span>
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({row.supplier_id})
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-xs font-medium",
                          row.status === "CLOSED" && "bg-muted",
                          row.status === "OPEN" && "bg-blue-500/15 text-blue-700 dark:text-blue-300",
                          row.status === "PARTIAL" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
                          row.status === "DRAFT" && "bg-zinc-500/15"
                        )}
                      >
                        {row.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {fmtDate(row.ordered_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {fmtDate(row.updated_at)}
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
              disabled={page <= 1 || loading}
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
              disabled={page >= totalPages || loading}
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
