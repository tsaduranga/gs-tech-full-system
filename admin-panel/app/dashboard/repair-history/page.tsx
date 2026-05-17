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

type RepairRow = {
  id: number;
  customer_id: number;
  customer_name: string;
  technician_user_id: number | null;
  technician_name: string | null;
  device_info: string | null;
  issue_description: string | null;
  status: string;
  invoice_id: number | null;
  linked_invoice_number: string | null;
  created_at: string;
  updated_at: string;
};

type RepairListResponse = {
  items: RepairRow[];
  total: number;
  page: number;
  pageSize: number;
};

type CustomerBrief = { id: number; name: string };

type UserBrief = { id: number; username: string; is_active?: number | boolean };

const PAGE_OPTIONS = [5, 10, 25, 50];

const STATUS_OPTS = [
  { value: "OPEN", label: "OPEN" },
  { value: "IN_PROGRESS", label: "IN_PROGRESS" },
  { value: "WAITING_PARTS", label: "WAITING_PARTS" },
  { value: "DONE", label: "DONE" },
  { value: "CLOSED", label: "CLOSED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return String(iso);
  }
}

function ellipsis(s: string | null | undefined, max: number) {
  if (!s) return "—";
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function RepairHistoryPage() {
  const [list, setList] = useState<RepairRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [customerFilterId, setCustomerFilterId] = useState(0);
  const [techFilterId, setTechFilterId] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [patchingId, setPatchingId] = useState<number | null>(null);

  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [metaLoading, setMetaLoading] = useState(true);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const pageSizeOptions = useMemo(
    () => PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    []
  );

  const techFilterOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.username} (${u.id})`,
      })),
    [users]
  );

  const loadMeta = useCallback(async () => {
    setMetaLoading(true);
    const [custRes, userRes] = await Promise.all([
      apiJson<{ items: CustomerBrief[] }>("/customers?page=1&pageSize=500"),
      apiJson<{ items: UserBrief[] }>("/users?page=1&pageSize=500"),
    ]);
    if (custRes.ok && Array.isArray(custRes.data?.items))
      setCustomers(custRes.data.items);
    else setCustomers([]);
    if (userRes.ok && Array.isArray(userRes.data?.items)) {
      setUsers(
        userRes.data.items.filter(
          (u) =>
            u.is_active === true || u.is_active === 1 || u.is_active === undefined
        )
      );
    } else setUsers([]);
    setMetaLoading(false);
  }, []);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (customerFilterId > 0) qs.set("customer_id", String(customerFilterId));
    if (techFilterId > 0)
      qs.set("technician_user_id", String(techFilterId));
    if (statusFilter.trim()) qs.set("status", statusFilter.trim());

    const res = await apiJson<RepairListResponse>(
      `/repairs?${qs.toString()}`,
      {}
    );
    setListLoading(false);
    if (!res.ok || !Array.isArray(res.data?.items)) {
      setListError(res.error ?? "Failed to load repair jobs");
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
    customerFilterId,
    techFilterId,
    statusFilter,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function applyListSearch() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  async function patchStatus(row: RepairRow, nextStatus: string) {
    const v = nextStatus.trim().toUpperCase();
    if (!v || v === row.status) return;
    setPatchingId(row.id);
    setListError(null);
    const res = await apiJson(`/repairs/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: v }),
    });
    setPatchingId(null);
    if (!res.ok) {
      setListError(res.error ?? "Status update failed");
      return;
    }
    void loadList();
  }

  return (
    <Card className="w-full border-border/80">
      <CardHeader>
        <CardTitle>Repair history</CardTitle>
        <CardDescription>
          Search and filter repair jobs; update workflow status inline.{" "}
          <Link
            href="/dashboard/repairs"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open a new repair job
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="rh-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="rh-q"
                placeholder="Customer, device notes, issue text, id…"
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
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="rh-cust">Customer</Label>
            <CatalogIdCombobox
              id="rh-cust"
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
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="rh-tech">Technician</Label>
            <SearchableNumPicker
              id="rh-tech"
              options={techFilterOptions}
              valueId={techFilterId}
              onValueChange={(id) => {
                setTechFilterId(id);
                setPage(1);
              }}
              placeholder="All technicians"
              loading={metaLoading}
              emptyListHint="No users"
              emptyFilterHint="No matches"
            />
          </div>
          <div className="flex min-w-[160px] flex-col gap-2">
            <Label htmlFor="rh-st">Status</Label>
            <SearchableStrPicker
              id="rh-st"
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
            <Label htmlFor="rh-ps">Rows per page</Label>
            <SearchableNumPicker
              id="rh-ps"
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
                <TableHead className="w-[56px]">Id</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Technician</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Issue</TableHead>
                <TableHead className="min-w-[140px]">Status</TableHead>
                <TableHead className="font-mono text-xs">Invoice</TableHead>
                <TableHead className="whitespace-nowrap">Updated</TableHead>
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
                    No repair jobs match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">{row.id}</TableCell>
                    <TableCell>
                      <span className="truncate">{row.customer_name}</span>
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        ({row.customer_id})
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.technician_name ? (
                        <>
                          {row.technician_name}
                          <span className="text-muted-foreground text-xs">
                            {" "}
                            ({row.technician_user_id})
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="max-w-[140px] text-sm text-muted-foreground"
                      title={row.device_info ?? undefined}
                    >
                      {ellipsis(row.device_info, 48)}
                    </TableCell>
                    <TableCell
                      className="max-w-[160px] text-sm text-muted-foreground"
                      title={row.issue_description ?? undefined}
                    >
                      {ellipsis(row.issue_description, 56)}
                    </TableCell>
                    <TableCell className="min-w-[160px]">
                      <SearchableStrPicker
                        id={`rh-row-st-${row.id}`}
                        options={STATUS_OPTS}
                        value={row.status}
                        placeholder="Status"
                        allowClear={false}
                        loading={patchingId === row.id}
                        onValueChange={(v) => {
                          void patchStatus(row, v);
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.linked_invoice_number ? (
                        <span title={`Invoice id ${row.invoice_id}`}>
                          {row.linked_invoice_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {fmtDateShort(row.updated_at)}
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
