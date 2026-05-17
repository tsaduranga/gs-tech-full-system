"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useForm,
  Controller,
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

type ParentCategory = {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

type ParentListResponse = { items: ParentCategory[] };

type SubcategoryRow = {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type SubcategoryListResponse = {
  items: SubcategoryRow[];
  total: number;
  page: number;
  pageSize: number;
};

type SubcategoryDetailResponse = {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PAGE_OPTIONS = [5, 10, 25, 50];

const textareaClass =
  "min-h-[72px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 aria-invalid:border-destructive";

const sortField = z.preprocess((v: unknown) => {
  if (v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v)))
    return 0;
  if (typeof v === "number") return Math.max(0, Math.floor(v));
  const n = parseInt(String(v).trim(), 10);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}, z.number().int().min(0));

const formSchema = z.object({
  category_id: z.coerce.number().int().min(1, "Pick a category"),
  name: z.string().trim().min(1, "Name is required").max(255),
  description: z.preprocess((v) => {
    if (v === undefined || v === null || v === "") return "";
    return typeof v === "string" ? v : String(v);
  }, z.string().max(500)),
  sort_order: sortField,
  is_active: z.boolean(),
});

type FormVals = z.output<typeof formSchema>;

function fieldErrorCls() {
  return "text-xs text-destructive";
}

export default function SubcategoriesPage() {
  const [parents, setParents] = useState<ParentCategory[]>([]);
  const [list, setList] = useState<SubcategoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [parentFilterId, setParentFilterId] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaults = useMemo<FormVals>(
    () => ({
      category_id: 0,
      name: "",
      description: "",
      sort_order: 0,
      is_active: true,
    }),
    []
  );

  const form = useForm<FormVals>({
    resolver: zodResolver(formSchema) as Resolver<FormVals>,
    defaultValues: defaults,
    mode: "onTouched",
  });

  const {
    register,
    control,
    watch,
    setValue,
    clearErrors,
    reset,
    formState,
    handleSubmit,
  } = form;

  const isActive = watch("is_active");

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const loadParents = useCallback(async () => {
    const res = await apiJson<ParentListResponse>(`/categories?page=1&pageSize=500`);
    if (res.ok && res.data?.items) setParents(res.data.items);
  }, []);

  useEffect(() => {
    void loadParents();
  }, [loadParents]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    if (parentFilterId > 0) qs.set("categoryId", String(parentFilterId));
    const res = await apiJson<SubcategoryListResponse>(`/subcategories?${qs}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load subcategories");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery, parentFilterId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  function resetDialog(firstParentId?: number) {
    setEditingId(null);
    reset({
      category_id:
        firstParentId && firstParentId > 0
          ? firstParentId
          : parentFilterId > 0
            ? parentFilterId
            : parents[0]?.id ?? 0,
      name: "",
      description: "",
      sort_order: 0,
      is_active: true,
    });
    clearErrors();
  }

  function applySearch() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  function openCreate() {
    const pid = parentFilterId > 0 ? parentFilterId : parents[0]?.id ?? 0;
    resetDialog(pid > 0 ? pid : undefined);
    setDialogOpen(true);
  }

  async function openEdit(row: SubcategoryRow) {
    setEditingId(row.id);
    reset({
      category_id: row.category_id,
      name: row.name,
      description: row.description ?? "",
      sort_order: row.sort_order,
      is_active: row.is_active,
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<SubcategoryDetailResponse>(`/subcategories/${row.id}`);
    if (res.ok && res.data) {
      reset({
        category_id: res.data.category_id,
        name: res.data.name,
        description: res.data.description ?? "",
        sort_order: res.data.sort_order,
        is_active: res.data.is_active,
      });
    }
  }

  const onSubmit: SubmitHandler<FormVals> = async (data) => {
    form.clearErrors("root");
    setSubmitting(true);
    const desc = data.description.trim();
    const payload: {
      category_id: number;
      name: string;
      description?: string | null;
      sort_order: number;
      is_active: boolean;
    } = {
      category_id: data.category_id,
      name: data.name.trim(),
      sort_order: data.sort_order,
      is_active: data.is_active,
    };
    if (editingId != null) payload.description = desc === "" ? null : desc;
    else if (desc !== "") payload.description = desc;
    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/subcategories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          form.setError("root", { type: "server", message: res.error ?? "Create failed" });
          setSubmitting(false);
          return;
        }
        setDialogOpen(false);
        resetDialog();
        setPage(1);
        await loadList();
        await loadParents();
        setSubmitting(false);
        return;
      }
      const res = await apiJson(`/subcategories/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSubmitting(false);
      if (!res.ok) {
        form.setError("root", { type: "server", message: res.error ?? "Update failed" });
        return;
      }
      setDialogOpen(false);
      resetDialog();
      await loadList();
      await loadParents();
    } catch {
      setSubmitting(false);
      form.setError("root", { type: "server", message: "Request failed unexpectedly" });
    }
  };

  const onBad: SubmitErrorHandler<FormVals> = () => {};

  async function remove(row: SubcategoryRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete subcategory "${row.name}" under ${row.category_name}? Linked items lose their subcategory link.`
      )
    )
      return;
    const res = await apiJson(`/subcategories/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setListError(res.error ?? "Delete failed");
      return;
    }
    if (list.length <= 1 && page > 1) setPage((p) => p - 1);
    await loadList();
    await loadParents();
  }

  function fmt(iso: string) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  const canAdd = parents.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Subcategories</CardTitle>
          <p className="text-sm text-muted-foreground">
            Second-level classifications under each category (used for catalogue and item grouping).
          </p>
        </div>
        <Button type="button" disabled={!canAdd} onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add subcategory
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!canAdd ? (
          <p className="text-sm text-muted-foreground">
            Create at least one category first, then define subcategories.
          </p>
        ) : null}

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="sub-q">Search</Label>
            <div className="flex gap-2">
              <Input
                id="sub-q"
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySearch()}
                placeholder="Name, category, description, id…"
              />
              <Button type="button" variant="outline" onClick={applySearch}>
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[200px] flex-col gap-2">
            <Label htmlFor="sub-parent">Parent category</Label>
            <CatalogIdCombobox
              id="sub-parent"
              items={parents.map((p) => ({ id: p.id, name: p.name }))}
              valueId={parentFilterId}
              onValueChange={(id) => {
                setParentFilterId(id);
                setPage(1);
              }}
              placeholder="All categories"
              emptyListHint="No categories"
              emptyFilterHint="No matching categories"
            />
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="sub-ps">Rows per page</Label>
            <SearchableNumPicker
              id="sub-ps"
              options={PAGE_OPTIONS.map((n) => ({
                value: n,
                label: String(n),
              }))}
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

        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-11">Id</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden max-w-[180px] sm:table-cell">Description</TableHead>
                <TableHead className="w-[64px]">Sort</TableHead>
                <TableHead className="w-[60px]">Active</TableHead>
                <TableHead className="w-[82px]">Updated</TableHead>
                <TableHead className="w-[112px] text-right">Actions</TableHead>
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
                    No subcategories yet.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-medium">{row.category_name}</TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="hidden text-muted-foreground text-sm sm:table-cell">
                      {row.description ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.sort_order}</TableCell>
                    <TableCell>{row.is_active ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmt(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void remove(row)}
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
            <span className="text-sm text-muted-foreground">
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
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit, onBad)}>
            <DialogHeader>
              <DialogTitle>
                {editingId == null ? "Add subcategory" : "Edit subcategory"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="sub-cat-id">
                  Category<span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="category_id"
                  render={({ field }) => (
                    <CatalogIdCombobox
                      id="sub-cat-id"
                      items={parents.map((p) => ({
                        id: p.id,
                        name: p.name,
                      }))}
                      valueId={Math.max(0, Number(field.value) || 0)}
                      onValueChange={(id) => field.onChange(id)}
                      placeholder="Select…"
                      emptyListHint="No categories — create one first"
                      emptyFilterHint="No matching categories"
                      invalid={Boolean(formState.errors.category_id)}
                    />
                  )}
                />
                {formState.errors.category_id?.message ? (
                  <p className={fieldErrorCls()}>
                    {String(formState.errors.category_id.message)}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sub-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input id="sub-name" {...register("name")} />
                {formState.errors.name?.message ? (
                  <p className={fieldErrorCls()}>{String(formState.errors.name.message)}</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sub-desc">Description</Label>
                <textarea
                  id="sub-desc"
                  className={cn(textareaClass, formState.errors.description && "border-destructive")}
                  {...register("description")}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sub-sort">Sort order</Label>
                <Input
                  id="sub-sort"
                  type="number"
                  min={0}
                  step={1}
                  {...register("sort_order", { valueAsNumber: true })}
                  className={cn(formState.errors.sort_order && "border-destructive")}
                />
                {formState.errors.sort_order?.message ? (
                  <p className={fieldErrorCls()}>
                    {String(formState.errors.sort_order.message)}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="sub-act"
                  checked={Boolean(isActive)}
                  onCheckedChange={(v) =>
                    setValue("is_active", v === true, { shouldDirty: true })
                  }
                />
                <Label htmlFor="sub-act" className="cursor-pointer font-normal">
                  Active
                </Label>
              </div>
              {formState.errors.root?.message ? (
                <p className={fieldErrorCls()}>{String(formState.errors.root.message)}</p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2Icon className="mr-2 size-4 animate-spin" />}
                {editingId == null ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
