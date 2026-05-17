"use client";

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
import { SearchableNumPicker } from "@/components/searchable-num-picker";

type TransferHistoryRow = {
  id: number;
  item_id: number;
  sku: string;
  item_name: string;
  from_warehouse_id: number;
  from_warehouse_code: string;
  from_warehouse_name: string;
  to_warehouse_id: number;
  to_warehouse_code: string;
  to_warehouse_name: string;
  quantity: number | string;
  created_at: string;
  created_by: number | null;
  created_by_username: string | null;
};

type ListResponse = {
  items: TransferHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
};

type WarehouseOpt = { id: number; code: string; name: string };

type ItemOpt = { id: number; sku: string; name: string };

const PAGE_OPTIONS = [5, 10, 25, 50];

function qtyDisplay(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n);
}

function fmtWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function TransferHistoryPage() {
  const [list, setList] = useState<TransferHistoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [itemFilterId, setItemFilterId] = useState(0);
  const [fromWhId, setFromWhId] = useState(0);
  const [toWhId, setToWhId] = useState(0);
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const warehouseOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: `${w.code} — ${w.name}`,
      })),
    [warehouses]
  );

  const itemOptions = useMemo(
    () =>
      items.map((i) => ({
        value: i.id,
        label: `${i.sku} — ${i.name}`,
      })),
    [items]
  );

  const pageSizeOptions = useMemo(
    () => PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    []
  );

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    const [whRes, itRes] = await Promise.all([
      apiJson<{ items: WarehouseOpt[] }>("/warehouses?page=1&pageSize=500"),
      apiJson<{ items: ItemOpt[] }>("/items?page=1&pageSize=500"),
    ]);
    if (whRes.ok && Array.isArray(whRes.data?.items))
      setWarehouses(whRes.data.items);
    else setWarehouses([]);
    if (itRes.ok && Array.isArray(itRes.data?.items))
      setItems(itRes.data.items);
    else setItems([]);
    setMetaLoading(false);
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (itemFilterId > 0) qs.set("item_id", String(itemFilterId));
    if (fromWhId > 0) qs.set("from_warehouse_id", String(fromWhId));
    if (toWhId > 0) qs.set("to_warehouse_id", String(toWhId));

    const res = await apiJson<ListResponse>(
      `/stock/transfer-history?${qs.toString()}`
    );
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setError(res.error ?? "Failed to load transfer history");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [
    page,
    pageSize,
    activeQuery,
    itemFilterId,
    fromWhId,
    toWhId,
  ]);

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
        <CardTitle>Transfer history</CardTitle>
        <p className="text-sm text-muted-foreground">
          Warehouse-to-warehouse transfers. Search by SKU, item name, warehouse
          code or name, or filter by item and warehouses.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="th-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="th-q"
                placeholder="SKU, item, warehouse, ids…"
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
            <Label htmlFor="th-item">Item</Label>
            <SearchableNumPicker
              id="th-item"
              options={itemOptions}
              valueId={itemFilterId}
              onValueChange={(id) => {
                setItemFilterId(id);
                setPage(1);
              }}
              placeholder="All items"
              loading={metaLoading}
              emptyListHint="No items"
              emptyFilterHint="No matching items"
            />
          </div>
          <div className="flex min-w-[220px] flex-col gap-2">
            <Label htmlFor="th-from">From warehouse</Label>
            <SearchableNumPicker
              id="th-from"
              options={warehouseOptions}
              valueId={fromWhId}
              onValueChange={(id) => {
                setFromWhId(id);
                setPage(1);
              }}
              placeholder="All sources"
              loading={metaLoading}
              emptyListHint="No warehouses"
              emptyFilterHint="No matches"
            />
          </div>
          <div className="flex min-w-[220px] flex-col gap-2">
            <Label htmlFor="th-to">To warehouse</Label>
            <SearchableNumPicker
              id="th-to"
              options={warehouseOptions}
              valueId={toWhId}
              onValueChange={(id) => {
                setToWhId(id);
                setPage(1);
              }}
              placeholder="All destinations"
              loading={metaLoading}
              emptyListHint="No warehouses"
              emptyFilterHint="No matches"
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="th-ps">Rows per page</Label>
            <SearchableNumPicker
              id="th-ps"
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
                <TableHead className="min-w-[140px]">When</TableHead>
                <TableHead className="w-[72px]">Item id</TableHead>
                <TableHead className="font-mono">SKU</TableHead>
                <TableHead className="min-w-[140px]">Item</TableHead>
                <TableHead className="min-w-[100px]">From</TableHead>
                <TableHead className="min-w-[100px]">To</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="min-w-[88px]">By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
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
                    No transfers match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {fmtWhen(row.created_at)}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.item_id}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.sku}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {row.item_name}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs">
                        {row.from_warehouse_code}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        ({row.from_warehouse_id})
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs">
                        {row.to_warehouse_code}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        ({row.to_warehouse_id})
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qtyDisplay(row.quantity)}
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
