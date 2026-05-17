"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useForm,
  type Resolver,
  type SubmitHandler,
  type SubmitErrorHandler,
} from "react-hook-form";
import {
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiJson } from "@/lib/api";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { SearchableNumPicker } from "@/components/searchable-num-picker";

const textareaClass =
  "min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50";

/** Empty / invalid yields NaN so zod `.finite()` / `.positive()` can fail. */
function parsePositiveMoney(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.NaN;
  const t = String(v ?? "").trim();
  if (t === "") return Number.NaN;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? n : Number.NaN;
}

function parseReorderLevel(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : Number.NaN;
  const t = String(v ?? "").trim();
  if (t === "") return Number.NaN;
  const n = parseFloat(t.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : Number.NaN;
}

function fieldErrorCls() {
  return "text-xs text-destructive";
}

type ItemRow = {
  id: number;
  sku: string;
  name: string;
  category: string | null;
  catalog_category_id?: number | null;
  subcategory_id?: number | null;
  subcategory_name?: string | null;
  description: string | null;
  unit_cost: number;
  unit_price: number;
  reorder_level: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CatalogPickerRow = { id: number; name: string };

type SubcategoryPickerRow = { id: number; name: string; category_id: number };

type ItemListResponse = {
  items: ItemRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_OPTIONS = [5, 10, 25, 50];

const itemFormSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required").max(100),
  name: z.string().trim().min(1, "Name is required").max(255),
  catalog_category_id: z.coerce
    .number()
    .int()
    .min(1, "Category is required"),
  subcategory_id: z.coerce
    .number()
    .int()
    .min(1, "Subcategory is required"),
  description: z.string().trim().max(16000).optional(),
  unit_cost: z
    .union([z.number(), z.string()])
    .transform(parsePositiveMoney)
    .pipe(z.number({ error: "" }).finite().positive("Unit cost must be greater than zero")),
  unit_price: z
    .union([z.number(), z.string()])
    .transform(parsePositiveMoney)
    .pipe(z.number({ error: "" }).finite().positive("Unit price must be greater than zero")),
  reorder_level: z
    .union([z.number(), z.string()])
    .transform(parseReorderLevel)
    .pipe(z.number({ error: "" }).finite().int().min(0, "Reorder level is required")),
  is_active: z.boolean(),
});

type ItemFormValues = z.output<typeof itemFormSchema>;

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(n);
  } catch {
    return String(n);
  }
}

export default function ItemsPage() {
  const [list, setList] = useState<ItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [pickerCategories, setPickerCategories] = useState<CatalogPickerRow[]>([]);
  const [pickerLoading, setPickerLoading] = useState(true);
  const [listCatalogCategoryId, setListCatalogCategoryId] = useState(0);
  const [listSubcategoryId, setListSubcategoryId] = useState(0);
  const [listSubChoices, setListSubChoices] = useState<SubcategoryPickerRow[]>(
    []
  );
  const [listSubsLoading, setListSubsLoading] = useState(false);
  const [subcategoryChoices, setSubcategoryChoices] = useState<SubcategoryPickerRow[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useMemo<ItemFormValues>(
    () => ({
      sku: "",
      name: "",
      catalog_category_id: 0,
      subcategory_id: 0,
      description: "",
      unit_cost: 0,
      unit_price: 0,
      reorder_level: 0,
      is_active: true,
    }),
    []
  );

  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemFormSchema) as Resolver<ItemFormValues>,
    defaultValues: defaults,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const {
    register,
    watch,
    setValue,
    clearErrors,
    reset,
    formState,
    handleSubmit,
  } = form;

  const isActiveVal = watch("is_active");
  const watchedCategoryId = watch("catalog_category_id");
  const watchedSubcategoryId = watch("subcategory_id");

  const refreshPickerCategories = useCallback(async () => {
    setPickerLoading(true);
    const res = await apiJson<CatalogPickerRow[]>("/categories/picker");
    if (res.ok && Array.isArray(res.data)) setPickerCategories(res.data);
    else setPickerCategories([]);
    setPickerLoading(false);
  }, []);

  useEffect(() => {
    void refreshPickerCategories();
  }, [refreshPickerCategories]);

  useEffect(() => {
    let cancelled = false;
    async function loadSubs() {
      if (!watchedCategoryId || watchedCategoryId < 1) {
        setSubcategoryChoices([]);
        setSubsLoading(false);
        return;
      }
      setSubsLoading(true);
      setSubcategoryChoices([]);
      const qs = new URLSearchParams({
        page: "1",
        pageSize: "500",
        categoryId: String(watchedCategoryId),
      });
      const res = await apiJson<{
        items: SubcategoryPickerRow[];
        total?: number;
      }>(`/subcategories?${qs.toString()}`);
      if (!cancelled) {
        setSubsLoading(false);
        setSubcategoryChoices(res.ok && Array.isArray(res.data?.items) ? res.data.items : []);
      }
    }
    void loadSubs();
    return () => {
      cancelled = true;
    };
  }, [watchedCategoryId]);

  useEffect(() => {
    let cancelled = false;
    async function loadToolbarSubs() {
      if (!listCatalogCategoryId || listCatalogCategoryId < 1) {
        setListSubChoices([]);
        setListSubsLoading(false);
        return;
      }
      setListSubsLoading(true);
      setListSubChoices([]);
      const qs = new URLSearchParams({
        page: "1",
        pageSize: "500",
        categoryId: String(listCatalogCategoryId),
      });
      const res = await apiJson<{
        items: SubcategoryPickerRow[];
        total?: number;
      }>(`/subcategories?${qs.toString()}`);
      if (!cancelled) {
        setListSubsLoading(false);
        setListSubChoices(
          res.ok && Array.isArray(res.data?.items) ? res.data.items : []
        );
      }
    }
    void loadToolbarSubs();
    return () => {
      cancelled = true;
    };
  }, [listCatalogCategoryId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const pageSizeOptions = useMemo(
    () => [5, 10, 25, 50].map((n) => ({ value: n, label: String(n) })),
    []
  );

  const listSubCatalogItems = useMemo(
    () => listSubChoices.map((s) => ({ id: s.id, name: s.name })),
    [listSubChoices]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (listSubcategoryId > 0) {
      qs.set("subcategory_id", String(listSubcategoryId));
    } else if (listCatalogCategoryId > 0) {
      qs.set("catalog_category_id", String(listCatalogCategoryId));
    }
    const res = await apiJson<ItemListResponse>(`/items?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load items");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery, listCatalogCategoryId, listSubcategoryId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function resetDialog() {
    setEditingId(null);
    reset(defaults);
    clearErrors();
  }

  function applyFilter() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  function openCreate() {
    resetDialog();
    setDialogOpen(true);
  }

  async function openEdit(row: ItemRow) {
    setEditingId(row.id);
    reset({
      sku: row.sku,
      name: row.name,
      catalog_category_id: Number(row.catalog_category_id ?? 0) || 0,
      subcategory_id: Number(row.subcategory_id ?? 0) || 0,
      description: row.description ?? "",
      unit_cost: Number(row.unit_cost),
      unit_price: Number(row.unit_price),
      reorder_level: Number(row.reorder_level),
      is_active: Boolean(row.is_active),
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<ItemRow>(`/items/${row.id}`);
    if (res.ok && res.data) {
      reset({
        sku: res.data.sku,
        name: res.data.name,
        catalog_category_id: Number(res.data.catalog_category_id ?? 0) || 0,
        subcategory_id: Number(res.data.subcategory_id ?? 0) || 0,
        description: res.data.description ?? "",
        unit_cost: Number(res.data.unit_cost),
        unit_price: Number(res.data.unit_price),
        reorder_level: Number(res.data.reorder_level),
        is_active: Boolean(res.data.is_active),
      });
    }
  }

  function toApiPayload(data: ItemFormValues) {
    const descTrim = data.description?.trim() ?? "";
    return {
      sku: data.sku.trim(),
      name: data.name.trim(),
      catalog_category_id: data.catalog_category_id > 0 ? data.catalog_category_id : null,
      subcategory_id: data.subcategory_id > 0 ? data.subcategory_id : null,
      description: descTrim === "" ? null : descTrim,
      unit_cost: data.unit_cost,
      unit_price: data.unit_price,
      reorder_level: data.reorder_level,
      is_active: data.is_active,
    };
  }

  const onSubmitValid: SubmitHandler<ItemFormValues> = async (data) => {
    form.clearErrors("root");
    setSubmitting(true);
    const payload = toApiPayload(data);

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          form.setError("root", {
            type: "server",
            message: res.error ?? "Could not create item",
          });
          setSubmitting(false);
          return;
        }
        setDialogOpen(false);
        resetDialog();
        setPage(1);
        await refreshPickerCategories();
        await loadList();
        setSubmitting(false);
        return;
      }

      const res = await apiJson(`/items/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setSubmitting(false);
      if (!res.ok) {
        form.setError("root", {
          type: "server",
          message: res.error ?? "Could not update item",
        });
        return;
      }
      setDialogOpen(false);
      resetDialog();
      await refreshPickerCategories();
      await loadList();
    } catch {
      setSubmitting(false);
      form.setError("root", {
        type: "server",
        message: "Request failed unexpectedly",
      });
    }
  };

  const onSubmitInvalid: SubmitErrorHandler<ItemFormValues> = () => {};

  async function deleteItem(row: ItemRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete item "${row.sku}" — ${row.name}?`)
    )
      return;
    const res = await apiJson(`/items/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setListError(res.error ?? "Delete failed");
      return;
    }
    if (list.length <= 1 && page > 1) setPage((p) => p - 1);
    await refreshPickerCategories();
    await loadList();
  }

  function fmtDate(iso: string) {
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

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Items</CardTitle>
          <p className="text-sm text-muted-foreground">
            Product catalogue: SKU, pricing, categories, and reorder levels.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add item
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="it-filter">Search</Label>
            <div className="flex gap-2">
              <Input
                id="it-filter"
                placeholder="SKU, name, description, category, or id…"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
              />
              <Button type="button" variant="outline" onClick={applyFilter}>
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="it-category">Category</Label>
            <CatalogIdCombobox
              id="it-category"
              items={pickerCategories}
              valueId={listCatalogCategoryId}
              onValueChange={(id) => {
                setListCatalogCategoryId(id);
                setListSubcategoryId(0);
                setPage(1);
              }}
              placeholder="All categories"
              loading={pickerLoading}
              emptyListHint="No categories"
              emptyFilterHint="No matching categories"
            />
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="it-sub">Subcategory</Label>
            <CatalogIdCombobox
              id="it-sub"
              items={listSubCatalogItems}
              valueId={listSubcategoryId}
              onValueChange={(id) => {
                setListSubcategoryId(id);
                setPage(1);
              }}
              placeholder={
                listCatalogCategoryId < 1
                  ? "Pick a category first"
                  : "All subcategories"
              }
              disabled={listCatalogCategoryId < 1}
              loading={listSubsLoading}
              emptyListHint={
                listCatalogCategoryId < 1
                  ? "Pick a category first"
                  : "No subcategories for this category"
              }
              emptyFilterHint="No matching subcategories"
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="it-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="it-page-size"
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
                <TableHead className="w-12">Id</TableHead>
                <TableHead className="min-w-[100px]">SKU</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="min-w-[100px]">Category</TableHead>
                <TableHead className="min-w-[100px]">Subcategory</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="w-[64px]">Active</TableHead>
                <TableHead className="w-[88px]">Updated</TableHead>
                <TableHead className="w-[112px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
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
                    No rows to display.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">
                      {row.sku}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.category ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.subcategory_name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {fmtMoney(row.unit_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {fmtMoney(row.reorder_level)}
                    </TableCell>
                    <TableCell>{row.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmtDate(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.sku}`}
                          onClick={() => void openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row.sku}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => void deleteItem(row)}
                        >
                          <Trash2Icon className="size-4" />
                        </Button>
                      </div>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(92vh,calc(100vh-2rem))] max-w-full flex-col gap-0 overflow-hidden p-1 sm:max-w-lg"
        >
          <form
            className="flex max-h-[min(88vh,calc(100vh-4rem))] flex-col gap-3"
            onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
          >
            <DialogHeader className="shrink-0 px-4 pt-4">
              <DialogTitle>
                {editingId == null ? "Add item" : "Edit item"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-1">
              <div className="grid gap-2">
                <Label htmlFor="it-sku">
                  SKU<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="it-sku"
                  className={cn(
                    "font-mono text-sm sm:max-w-xs",
                    formState.errors.sku && "border-destructive"
                  )}
                  autoComplete="off"
                  aria-invalid={Boolean(formState.errors.sku)}
                  disabled={editingId != null}
                  title={
                    editingId != null
                      ? "SKU is fixed after create to avoid breaking references."
                      : undefined
                  }
                  {...register("sku")}
                />
                {formState.errors.sku?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.sku.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="it-catalog-category">
                    Category<span className="text-destructive">*</span>
                  </Label>
                  <CatalogIdCombobox
                    id="it-catalog-category"
                    items={pickerCategories}
                    valueId={watchedCategoryId}
                    loading={pickerLoading}
                    placeholder="Search or choose a category…"
                    emptyListHint="No categories — add them under Master Data → Categories."
                    invalid={Boolean(formState.errors.catalog_category_id)}
                    onValueChange={(next) => {
                      setValue("catalog_category_id", next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      setValue("subcategory_id", 0, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  />
                  {formState.errors.catalog_category_id?.message ? (
                    <p className={fieldErrorCls()} role="alert">
                      {String(formState.errors.catalog_category_id.message)}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="it-subcategory">
                    Subcategory<span className="text-destructive">*</span>
                  </Label>
                  <CatalogIdCombobox
                    id="it-subcategory"
                    items={subcategoryChoices.map((s) => ({ id: s.id, name: s.name }))}
                    valueId={watchedSubcategoryId}
                    disabled={watchedCategoryId < 1}
                    loading={watchedCategoryId >= 1 && subsLoading}
                    placeholder={
                      watchedCategoryId < 1
                        ? "Select a category first…"
                        : "Search or choose a subcategory…"
                    }
                    emptyListHint={
                      watchedCategoryId < 1
                        ? "Select a category first."
                        : "No subcategories for this category."
                    }
                    invalid={Boolean(formState.errors.subcategory_id)}
                    onValueChange={(next) =>
                      setValue("subcategory_id", next, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  />
                  {formState.errors.subcategory_id?.message ? (
                    <p className={fieldErrorCls()} role="alert">
                      {String(formState.errors.subcategory_id.message)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="it-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="it-name"
                  aria-invalid={Boolean(formState.errors.name)}
                  className={cn(formState.errors.name && "border-destructive")}
                  {...register("name")}
                />
                {formState.errors.name?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.name.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="it-desc">Description</Label>
                <textarea
                  id="it-desc"
                  className={cn(
                    textareaClass,
                    formState.errors.description && "border-destructive"
                  )}
                  aria-invalid={Boolean(formState.errors.description)}
                  {...register("description")}
                />
                {formState.errors.description?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.description.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="it-cost">
                    Unit cost<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="it-cost"
                    type="number"
                    step="any"
                    min={0.0001}
                    aria-invalid={Boolean(formState.errors.unit_cost)}
                    className={cn(
                      "tabular-nums",
                      formState.errors.unit_cost && "border-destructive"
                    )}
                    {...register("unit_cost")}
                  />
                  {formState.errors.unit_cost?.message ? (
                    <p className={fieldErrorCls()} role="alert">
                      {String(formState.errors.unit_cost.message)}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="it-price">
                    Unit price<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="it-price"
                    type="number"
                    step="any"
                    min={0.0001}
                    aria-invalid={Boolean(formState.errors.unit_price)}
                    className={cn(
                      "tabular-nums",
                      formState.errors.unit_price && "border-destructive"
                    )}
                    {...register("unit_price")}
                  />
                  {formState.errors.unit_price?.message ? (
                    <p className={fieldErrorCls()} role="alert">
                      {String(formState.errors.unit_price.message)}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="it-reorder">
                    Reorder level<span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="it-reorder"
                    type="number"
                    step={1}
                    min={0}
                    aria-invalid={Boolean(formState.errors.reorder_level)}
                    className={cn(
                      "tabular-nums",
                      formState.errors.reorder_level && "border-destructive"
                    )}
                    {...register("reorder_level")}
                  />
                  {formState.errors.reorder_level?.message ? (
                    <p className={fieldErrorCls()} role="alert">
                      {String(formState.errors.reorder_level.message)}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="it-active"
                  checked={Boolean(isActiveVal)}
                  onCheckedChange={(v) =>
                    setValue("is_active", v === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="it-active" className="cursor-pointer font-normal">
                  Active
                </Label>
              </div>

              {formState.errors.root?.message ? (
                <p className={fieldErrorCls()} role="alert">
                  {String(formState.errors.root.message)}
                </p>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-border px-4 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : null}
                {editingId == null ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
