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

type Row = {
  id: number;
  purchase_order_id: number;
  order_number: string;
  supplier_id: number;
  supplier_name: string;
  received_at: string;
  created_by_username: string | null;
};

type ListResponse = { items: Row[]; total: number; page: number; pageSize: number };

type SupplierBrief = { id: number; name: string };

const PAGE_OPTIONS = [5, 10, 25, 50];

function fmt(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function GrnHistoryPage() {
  const [list, setList] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [supplierId, setSupplierId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierBrief[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );
  const pageOpts = useMemo(
    () => PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    []
  );

  useEffect(() => {
    async function m() {
      setMetaLoading(true);
      const r = await apiJson<{ items: SupplierBrief[] }>(
        "/suppliers?page=1&pageSize=500"
      );
      setSuppliers(r.ok && Array.isArray(r.data?.items) ? r.data.items : []);
      setMetaLoading(false);
    }
    void m();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (supplierId > 0) qs.set("supplier_id", String(supplierId));
    const res = await apiJson<ListResponse>(`/goods-receipts?${qs}`, {});
    setLoading(false);
    if (!res.ok || !Array.isArray(res.data?.items)) {
      setErr(res.error ?? "Failed to load GRNs");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery, supplierId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="w-full border-border/80">
      <CardHeader>
        <CardTitle>GRN history</CardTitle>
        <CardDescription>
          Goods receipts posted against purchase orders.{" "}
          <Link
            href="/dashboard/goods-receipts"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Post a GRN
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="grnh-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="grnh-q"
                placeholder="PO #, supplier, receipt id…"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (setPage(1), setActiveQuery(filterInput.trim()))
                }
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
          <div className="min-w-[220px] space-y-2">
            <Label>Supplier</Label>
            <CatalogIdCombobox
              id="grnh-sup"
              items={suppliers.map((s) => ({
                id: s.id,
                name: `${s.name} (${s.id})`,
              }))}
              valueId={supplierId}
              onValueChange={(id) => {
                setSupplierId(id);
                setPage(1);
              }}
              placeholder="All suppliers"
              loading={metaLoading}
              emptyListHint="No suppliers"
              emptyFilterHint="No matches"
            />
          </div>
          <div className="min-w-[120px] space-y-2">
            <Label>Rows</Label>
            <SearchableNumPicker
              id="grnh-ps"
              options={pageOpts}
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
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[72px]">GRN id</TableHead>
                <TableHead>PO #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No receipts found.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums font-mono text-xs">
                      {r.id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.order_number}
                      <span className="text-muted-foreground">
                        {" "}
                        (PO #{r.purchase_order_id})
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.supplier_name}
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({r.supplier_id})
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {fmt(r.received_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.created_by_username ?? "—"}
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
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="py-2 text-sm text-muted-foreground">
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
