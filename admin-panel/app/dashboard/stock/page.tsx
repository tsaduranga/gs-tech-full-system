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
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";

type StockRow = {
  warehouse_id: number;
  item_id: number;
  quantity: number | string;
  sku: string;
  name: string;
  reorder_level: number | string;
  warehouse_code: string;
  item_category: string | null;
};

type StockListResponse = {
  items: StockRow[];
  total: number;
  page: number;
  pageSize: number;
};

type WarehouseOption = {
  id: number;
  code: string;
  name: string;
};

type CatalogPickerRow = { id: number; name: string };
type SubcategoryPickerRow = { id: number; name: string; category_id: number };

const PAGE_OPTIONS = [5, 10, 25, 50];

function qtyDisplay(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n);
}

export default function StockPage() {
  const [list, setList] = useState<StockRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [warehouseFilterId, setWarehouseFilterId] = useState(0);
  const [catalogCategoryFilterId, setCatalogCategoryFilterId] = useState(0);
  const [subcategoryFilterId, setSubcategoryFilterId] = useState(0);
  const [pickerCategories, setPickerCategories] = useState<CatalogPickerRow[]>(
    []
  );
  const [pickerCategoriesLoading, setPickerCategoriesLoading] =
    useState(false);
  const [subChoices, setSubChoices] = useState<SubcategoryPickerRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const warehouseComboOptions = useMemo(
    () =>
      warehouses.map((w) => ({
        value: w.id,
        label: `${w.code} — ${w.name}`,
      })),
    [warehouses]
  );

  const pageSizeOptions = useMemo(
    () => PAGE_OPTIONS.map((n) => ({ value: n, label: String(n) })),
    []
  );

  const loadWarehouses = useCallback(async () => {
    const res = await apiJson<{
      items: Record<string, unknown>[];
      total: number;
    }>("/warehouses?page=1&pageSize=500");
    if (!res.ok || !res.data?.items) return;
    setWarehouses(
      res.data.items.map((r) => ({
        id: Number(r.id),
        code: String(r.code ?? ""),
        name: String(r.name ?? ""),
      }))
    );
  }, []);

  const loadPickerCategories = useCallback(async () => {
    setPickerCategoriesLoading(true);
    const res = await apiJson<CatalogPickerRow[]>("/categories/picker");
    if (res.ok && Array.isArray(res.data)) setPickerCategories(res.data);
    else setPickerCategories([]);
    setPickerCategoriesLoading(false);
  }, []);

  useEffect(() => {
    void loadWarehouses();
    void loadPickerCategories();
  }, [loadWarehouses, loadPickerCategories]);

  useEffect(() => {
    let cancelled = false;
    async function loadSubs() {
      if (!catalogCategoryFilterId || catalogCategoryFilterId < 1) {
        setSubChoices([]);
        setSubsLoading(false);
        return;
      }
      setSubsLoading(true);
      setSubChoices([]);
      const qs = new URLSearchParams({
        page: "1",
        pageSize: "500",
        categoryId: String(catalogCategoryFilterId),
      });
      const res = await apiJson<{
        items: SubcategoryPickerRow[];
        total?: number;
      }>(`/subcategories?${qs.toString()}`);
      if (!cancelled) {
        setSubsLoading(false);
        setSubChoices(
          res.ok && Array.isArray(res.data?.items) ? res.data.items : []
        );
      }
    }
    void loadSubs();
    return () => {
      cancelled = true;
    };
  }, [catalogCategoryFilterId]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (warehouseFilterId > 0) qs.set("warehouse_id", String(warehouseFilterId));
    if (subcategoryFilterId > 0) {
      qs.set("subcategory_id", String(subcategoryFilterId));
    } else if (catalogCategoryFilterId > 0) {
      qs.set("catalog_category_id", String(catalogCategoryFilterId));
    }

    const res = await apiJson<StockListResponse>(`/stock?${qs}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setError(res.error ?? "Failed to load stock");
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
    warehouseFilterId,
    catalogCategoryFilterId,
    subcategoryFilterId,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function applyFilters() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  const subCatalogItems = useMemo(
    () => subChoices.map((s) => ({ id: s.id, name: s.name })),
    [subChoices]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock by warehouse</CardTitle>
        <p className="text-sm text-muted-foreground">
          Search by SKU, name, warehouse code, or id. Filter by warehouse,
          category, and subcategory when catalog data is configured.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="stk-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="stk-q"
                placeholder="SKU, item name, warehouse code, ids…"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
              />
              <Button type="button" variant="outline" onClick={applyFilters}>
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="stk-wh">Warehouse</Label>
            <SearchableNumPicker
              id="stk-wh"
              options={warehouseComboOptions}
              valueId={warehouseFilterId}
              onValueChange={(id) => {
                setWarehouseFilterId(id);
                setPage(1);
              }}
              placeholder="All warehouses"
              loading={false}
              emptyListHint="No warehouses"
              emptyFilterHint="No matching warehouses"
            />
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="stk-cat">Category</Label>
            <CatalogIdCombobox
              id="stk-cat"
              items={pickerCategories}
              valueId={catalogCategoryFilterId}
              onValueChange={(id) => {
                setCatalogCategoryFilterId(id);
                setSubcategoryFilterId(0);
                setPage(1);
              }}
              placeholder="All categories"
              loading={pickerCategoriesLoading}
              emptyListHint="No categories"
              emptyFilterHint="No matching categories"
            />
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="stk-sub">Subcategory</Label>
            <CatalogIdCombobox
              id="stk-sub"
              items={subCatalogItems}
              valueId={subcategoryFilterId}
              onValueChange={(id) => {
                setSubcategoryFilterId(id);
                setPage(1);
              }}
              placeholder={
                catalogCategoryFilterId < 1
                  ? "Pick a category first"
                  : "All subcategories"
              }
              disabled={catalogCategoryFilterId < 1}
              loading={subsLoading}
              emptyListHint={
                catalogCategoryFilterId < 1
                  ? "Pick a category first"
                  : "No subcategories for this category"
              }
              emptyFilterHint="No matching subcategories"
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="stk-ps">Rows per page</Label>
            <SearchableNumPicker
              id="stk-ps"
              options={pageSizeOptions}
              valueId={pageSize}
              onValueChange={(id) => {
                if (!PAGE_OPTIONS.includes(id)) return;
                setPageSize(id);
                setPage(1);
              }}
              placeholder="Rows"
              disabled={PAGE_OPTIONS.length === 0}
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
                <TableHead className="w-[88px]">Warehouse id</TableHead>
                <TableHead className="min-w-[72px]">Code</TableHead>
                <TableHead className="w-[72px]">Item id</TableHead>
                <TableHead className="font-mono">SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="min-w-[96px]">Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
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
                    No stock rows match.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={`${row.warehouse_id}-${row.item_id}`}>
                    <TableCell className="tabular-nums">
                      {row.warehouse_id}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.warehouse_code}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.item_id}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {row.sku}
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.item_category ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qtyDisplay(row.quantity)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {qtyDisplay(row.reorder_level)}
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
