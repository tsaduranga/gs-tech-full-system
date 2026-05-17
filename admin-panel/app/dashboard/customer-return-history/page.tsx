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
  customer_id: number;
  customer_name: string;
  warehouse_id: number;
  warehouse_code: string;
  return_number: string;
  status: string;
  invoice_id: number | null;
  linked_invoice_number: string | null;
  updated_at: string;
  created_by_username: string | null;
};

type ListResponse = { items: Row[]; total: number; page: number; pageSize: number };

type CustomerBrief = { id: number; name: string };

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

export default function CustomerReturnHistoryPage() {
  const [list, setList] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [customerId, setCustomerId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
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
      const r = await apiJson<{ items: CustomerBrief[] }>(
        "/customers?page=1&pageSize=500"
      );
      setCustomers(r.ok && Array.isArray(r.data?.items) ? r.data.items : []);
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
    if (customerId > 0) qs.set("customer_id", String(customerId));
    const res = await apiJson<ListResponse>(`/customer-returns?${qs}`, {});
    setLoading(false);
    if (!res.ok || !Array.isArray(res.data?.items)) {
      setErr(res.error ?? "Failed to load");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery, customerId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="w-full border-border/80">
      <CardHeader>
        <CardTitle>Customer return history</CardTitle>
        <CardDescription>
          <Link
            href="/dashboard/customer-returns"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            New customer return
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label>Search</Label>
            <div className="flex gap-2">
              <Input
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
            <Label>Customer</Label>
            <CatalogIdCombobox
              id="crh-cust"
              items={customers.map((c) => ({
                id: c.id,
                name: `${c.name} (${c.id})`,
              }))}
              valueId={customerId}
              onValueChange={(id) => {
                setCustomerId(id);
                setPage(1);
              }}
              placeholder="All"
              loading={metaLoading}
              emptyListHint="—"
              emptyFilterHint="—"
            />
          </div>
          <div className="min-w-[100px] space-y-2">
            <Label>Rows</Label>
            <SearchableNumPicker
              id="crh-ps"
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
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Id</TableHead>
                <TableHead>Return #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>WH</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
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
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No returns.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="tabular-nums">{r.id}</TableCell>
                    <TableCell className="font-mono text-xs">{r.return_number}</TableCell>
                    <TableCell>{r.customer_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.warehouse_code}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.linked_invoice_number ?? "—"}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmt(r.updated_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            {total === 0 ? "No results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
          </span>
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
            <span className="py-1.5">
              {page} / {totalPages}
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
