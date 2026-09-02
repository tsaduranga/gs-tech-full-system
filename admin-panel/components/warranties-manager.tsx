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
  ClockIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useRouteAccess } from "@/lib/auth-context";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import { useConfirmDialog } from "@/components/confirm-dialog";
import { formatWarrantyDisplay } from "@/lib/warranty-format";

export type WarrantyType = "customer" | "supplier";

export type WarrantiesManagerProps = {
  warrantyType: WarrantyType;
  title: string;
  description: string;
};

type WarrantyRow = {
  id: number;
  name: string;
  warranty_years: number;
  warranty_months: number;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

type WarrantyListResponse = {
  items: WarrantyRow[];
  total: number;
  page: number;
  pageSize: number;
};

type WarrantyDetailResponse = {
  id: number;
  name: string;
  warranty_years: number;
  warranty_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PAGE_OPTIONS = [5, 10, 25, 50];

function parseNonNegativeInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return 0;
}

const warrantySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(255),
    warranty_years: z
      .union([z.number(), z.string()])
      .transform(parseNonNegativeInt)
      .pipe(z.number().finite().int().min(0).max(50)),
    warranty_months: z
      .union([z.number(), z.string()])
      .transform(parseNonNegativeInt)
      .pipe(z.number().finite().int().min(0).max(11, "Months cannot exceed 11")),
    is_active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.warranty_years <= 0 && data.warranty_months <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Enter warranty years or months",
        path: ["warranty_years"],
      });
    }
  });

type WarrantyFormValues = z.output<typeof warrantySchema>;

function fieldErrorCls() {
  return "text-xs text-destructive";
}

function apiQuery(warrantyType: WarrantyType, extra?: Record<string, string>) {
  return new URLSearchParams({ type: warrantyType, ...extra });
}

export function WarrantiesManager({
  warrantyType,
  title,
  description,
}: WarrantiesManagerProps) {
  const idPrefix = `war-${warrantyType}`;
  const isCustomer = warrantyType === "customer";

  const [list, setList] = useState<WarrantyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { confirm, dialog: confirmDialog } = useConfirmDialog();
  const { canEdit } = useRouteAccess();

  const defaults = useMemo<WarrantyFormValues>(
    () => ({
      name: "",
      warranty_years: 0,
      warranty_months: 0,
      is_active: true,
    }),
    []
  );

  const form = useForm<WarrantyFormValues>({
    resolver: zodResolver(warrantySchema) as Resolver<WarrantyFormValues>,
    defaultValues: defaults,
    mode: "onTouched",
  });

  const { register, watch, setValue, clearErrors, reset, formState, handleSubmit } = form;
  const isActive = watch("is_active");
  const watchedName = watch("name");
  const watchedYears = watch("warranty_years");
  const watchedMonths = watch("warranty_months");

  const previewLabel = useMemo(
    () =>
      formatWarrantyDisplay(
        watchedName?.trim() || null,
        Number(watchedYears ?? 0),
        Number(watchedMonths ?? 0)
      ),
    [watchedName, watchedYears, watchedMonths]
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const qs = apiQuery(warrantyType, {
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    const res = await apiJson<WarrantyListResponse>(`/warranties?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load warranties");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [warrantyType, page, pageSize, activeQuery]);

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

  async function openEdit(row: WarrantyRow) {
    setEditingId(row.id);
    reset({
      name: row.name,
      warranty_years: Number(row.warranty_years ?? 0),
      warranty_months: Number(row.warranty_months ?? 0),
      is_active: Boolean(row.is_active),
    });
    clearErrors();
    setDialogOpen(true);
    const qs = apiQuery(warrantyType);
    const res = await apiJson<WarrantyDetailResponse>(`/warranties/${row.id}?${qs.toString()}`);
    if (res.ok && res.data) {
      reset({
        name: res.data.name,
        warranty_years: Number(res.data.warranty_years ?? 0),
        warranty_months: Number(res.data.warranty_months ?? 0),
        is_active: res.data.is_active,
      });
    }
  }

  const onSubmit: SubmitHandler<WarrantyFormValues> = async (data) => {
    form.clearErrors("root");
    setSubmitting(true);
    const payload = {
      name: data.name.trim(),
      warranty_years: data.warranty_years,
      warranty_months: data.warranty_months,
      is_active: data.is_active,
    };
    const qs = apiQuery(warrantyType);
    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>(`/warranties?${qs.toString()}`, {
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
        setSubmitting(false);
        return;
      }
      const res = await apiJson(`/warranties/${editingId}?${qs.toString()}`, {
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
    } catch {
      setSubmitting(false);
      form.setError("root", { type: "server", message: "Request failed unexpectedly" });
    }
  };

  const onBad: SubmitErrorHandler<WarrantyFormValues> = () => {};

  async function remove(row: WarrantyRow) {
    const ok = await confirm({
      title: `Delete ${isCustomer ? "customer" : "supplier"} warranty`,
      description: isCustomer
        ? `Remove warranty "${row.name}" from lists? Items using it will have no warranty assigned. Historical records are kept.`
        : `Remove warranty "${row.name}" from lists? Historical purchase records are kept.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const qs = apiQuery(warrantyType);
    const res = await apiJson(`/warranties/${row.id}?${qs.toString()}`, { method: "DELETE" });
    if (!res.ok) {
      setListError(res.error ?? "Delete failed");
      return;
    }
    if (list.length <= 1 && page > 1) setPage((p) => p - 1);
    await loadList();
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

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {canEdit ? (
          <Button
            type="button"
            onClick={() => {
              resetDialog();
              setDialogOpen(true);
            }}
          >
            <PlusIcon className="mr-2 size-4" />
            Add warranty
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor={`${idPrefix}-q`}>Search</Label>
            <div className="flex gap-2">
              <Input
                id={`${idPrefix}-q`}
                value={filterInput}
                onChange={(e) => setFilterInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilter()}
                placeholder="Name, duration, or id…"
              />
              <Button type="button" variant="outline" onClick={applyFilter}>
                <SearchIcon className="mr-1 size-4" />
                Search
              </Button>
            </div>
          </div>
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor={`${idPrefix}-ps`}>Rows per page</Label>
            <SearchableNumPicker
              id={`${idPrefix}-ps`}
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

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[72px]">Id</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Updated</TableHead>
                {canEdit ? <TableHead className="w-[100px] text-right">Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 6 : 5} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canEdit ? 6 : 5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No {isCustomer ? "customer" : "supplier"} warranties yet.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">{row.id}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>
                      {formatWarrantyDisplay(null, row.warranty_years, row.warranty_months)}
                    </TableCell>
                    <TableCell>{Boolean(row.is_active) ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground">{fmt(row.updated_at)}</TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => void openEdit(row)}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => void remove(row)}
                          >
                            <Trash2Icon className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {total} total · page {page} of {totalPages}
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
          if (submitting) return;
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(90vh,calc(100vh-2rem))] max-w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          <form
            className="flex max-h-[min(86vh,calc(100vh-4rem))] flex-col"
            onSubmit={handleSubmit(onSubmit, onBad)}
            noValidate
          >
            <DialogHeader>
              <DialogTitle>
                {editingId == null ? `Add ${isCustomer ? "customer" : "supplier"} warranty` : "Edit warranty"}
              </DialogTitle>
              <DialogDescription>
                {editingId == null
                  ? isCustomer
                    ? "Create a warranty plan to offer customers on sold items."
                    : "Create a warranty term from a supplier on purchased goods."
                  : "Update the warranty name or coverage period."}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <ShieldCheckIcon className="size-4" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Preview
                  </p>
                  <p className="text-sm font-medium leading-snug text-foreground">
                    {previewLabel === "—" ? "Enter a name and duration below" : previewLabel}
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-name`}>
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`${idPrefix}-name`}
                  placeholder={
                    isCustomer ? "e.g. Manufacturer warranty" : "e.g. Supplier replacement warranty"
                  }
                  autoComplete="off"
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

              <div className="rounded-lg border border-border/70 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ClockIcon className="size-4 text-muted-foreground" aria-hidden />
                  <p className="text-sm font-medium">Coverage period</p>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Set years and/or months. At least one must be greater than zero.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-years`}>Years</Label>
                    <Input
                      id={`${idPrefix}-years`}
                      type="number"
                      step={1}
                      min={0}
                      max={50}
                      inputMode="numeric"
                      aria-invalid={Boolean(formState.errors.warranty_years)}
                      className={cn(
                        "tabular-nums",
                        formState.errors.warranty_years && "border-destructive"
                      )}
                      {...register("warranty_years")}
                    />
                    {formState.errors.warranty_years?.message ? (
                      <p className={fieldErrorCls()} role="alert">
                        {String(formState.errors.warranty_years.message)}
                      </p>
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor={`${idPrefix}-months`}>Months</Label>
                    <Input
                      id={`${idPrefix}-months`}
                      type="number"
                      step={1}
                      min={0}
                      max={11}
                      inputMode="numeric"
                      aria-invalid={Boolean(formState.errors.warranty_months)}
                      className={cn(
                        "tabular-nums",
                        formState.errors.warranty_months && "border-destructive"
                      )}
                      {...register("warranty_months")}
                    />
                    {formState.errors.warranty_months?.message ? (
                      <p className={fieldErrorCls()} role="alert">
                        {String(formState.errors.warranty_months.message)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2.5">
                <Checkbox
                  id={`${idPrefix}-active`}
                  checked={Boolean(isActive)}
                  onCheckedChange={(v) =>
                    setValue("is_active", v === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor={`${idPrefix}-active`} className="cursor-pointer font-normal leading-snug">
                  Active
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {isCustomer
                      ? "Inactive plans stay in history but cannot be assigned to new items."
                      : "Inactive plans stay in history but cannot be selected on new purchase documents."}
                  </span>
                </Label>
              </div>

              {formState.errors.root?.message ? (
                <p className={fieldErrorCls()} role="alert">
                  {String(formState.errors.root.message)}
                </p>
              ) : null}
            </div>

            <DialogFooter className="shrink-0 border-t border-border px-4 py-4">
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                ) : null}
                {editingId == null ? "Create warranty" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </Card>
  );
}
