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
import { useRouteAccess } from "@/lib/auth-context";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import { useConfirmDialog } from "@/components/confirm-dialog";

type CreditPeriodRow = {
  id: number;
  name: string;
  days: number;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

type CreditPeriodListResponse = {
  items: CreditPeriodRow[];
  total: number;
  page: number;
  pageSize: number;
};

type CreditPeriodDetailResponse = {
  id: number;
  name: string;
  days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PAGE_OPTIONS = [5, 10, 25, 50];

function fieldErrorCls() {
  return "text-xs text-destructive";
}

const creditPeriodFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  days: z.coerce
    .number()
    .int("Days must be a whole number")
    .min(0, "Days cannot be negative")
    .max(3650, "Days cannot exceed 3650"),
  is_active: z.boolean(),
});

type CreditPeriodFormValues = z.infer<typeof creditPeriodFormSchema>;

export default function CreditPeriodsPage() {
  const [list, setList] = useState<CreditPeriodRow[]>([]);
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

  const defaults = useMemo<CreditPeriodFormValues>(
    () => ({
      name: "",
      days: 0,
      is_active: true,
    }),
    []
  );

  const form = useForm<CreditPeriodFormValues>({
    resolver: zodResolver(creditPeriodFormSchema) as Resolver<CreditPeriodFormValues>,
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

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    const res = await apiJson<CreditPeriodListResponse>(
      `/credit-periods?${qs.toString()}`
    );
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load credit periods");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery]);

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

  async function openEdit(row: CreditPeriodRow) {
    setEditingId(row.id);
    reset({
      name: row.name,
      days: Number(row.days),
      is_active: Boolean(row.is_active),
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<CreditPeriodDetailResponse>(
      `/credit-periods/${row.id}`
    );
    if (res.ok && res.data) {
      reset({
        name: res.data.name,
        days: Number(res.data.days),
        is_active: Boolean(res.data.is_active),
      });
    }
  }

  const onSubmitValid: SubmitHandler<CreditPeriodFormValues> = async (data) => {
    form.clearErrors("root");
    setSubmitting(true);
    const payload = {
      name: data.name.trim(),
      days: data.days,
      is_active: data.is_active,
    };

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/credit-periods", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          form.setError("root", {
            type: "server",
            message: res.error ?? "Could not create credit period",
          });
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

      const res = await apiJson(`/credit-periods/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setSubmitting(false);
      if (!res.ok) {
        form.setError("root", {
          type: "server",
          message: res.error ?? "Could not update credit period",
        });
        return;
      }
      setDialogOpen(false);
      resetDialog();
      await loadList();
    } catch {
      setSubmitting(false);
      form.setError("root", {
        type: "server",
        message: "Request failed unexpectedly",
      });
    }
  };

  const onSubmitInvalid: SubmitErrorHandler<CreditPeriodFormValues> = () => {};

  async function deleteCreditPeriod(row: CreditPeriodRow) {
    const ok = await confirm({
      title: "Delete credit period",
      description: `Remove credit period "${row.name}" (${row.days} days) from lists? Historical records are kept.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    const res = await apiJson(`/credit-periods/${row.id}`, { method: "DELETE" });
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
          <CardTitle>Credit periods</CardTitle>
          <p className="text-sm text-muted-foreground">
            Payment terms used for customers and suppliers (e.g. Cash, Net 30).
          </p>
        </div>
        {canEdit ? (
          <Button type="button" onClick={openCreate}>
            <PlusIcon className="mr-2 size-4" />
            Add credit period
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="cp-filter">Filter</Label>
            <div className="flex gap-2">
              <Input
                id="cp-filter"
                placeholder="Search name, days, or id…"
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
          <div className="flex min-w-[140px] flex-col gap-2">
            <Label htmlFor="cp-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="cp-page-size"
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

        <div className="relative overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">Id</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[100px]">Days</TableHead>
                <TableHead className="w-[72px]">Active</TableHead>
                <TableHead className="w-[100px]">Updated</TableHead>
                {canEdit ? (
                  <TableHead className="w-[112px] text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No rows to display.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="tabular-nums">{row.days}</TableCell>
                    <TableCell>{Boolean(row.is_active) ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmt(row.updated_at)}
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => void openEdit(row)}
                          >
                            <PencilIcon className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${row.name}`}
                            className="text-destructive hover:text-destructive"
                            onClick={() => void deleteCreditPeriod(row)}
                          >
                            <Trash2Icon className="size-4" />
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
        <DialogContent showCloseButton className="sm:max-w-md">
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
          >
            <DialogHeader>
              <DialogTitle>
                {editingId == null ? "Add credit period" : "Edit credit period"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 px-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="cp-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cp-name"
                  aria-invalid={Boolean(formState.errors.name)}
                  className={cn(formState.errors.name && "border-destructive")}
                  placeholder="e.g. Net 30"
                  autoComplete="off"
                  {...register("name")}
                />
                {formState.errors.name?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.name.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cp-days">
                  Days<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cp-days"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={3650}
                  step={1}
                  aria-invalid={Boolean(formState.errors.days)}
                  className={cn(
                    "tabular-nums",
                    formState.errors.days && "border-destructive"
                  )}
                  placeholder="e.g. 30"
                  {...register("days")}
                />
                {formState.errors.days?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.days.message)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Use 0 for cash / immediate payment.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="cp-active"
                  checked={Boolean(isActiveVal)}
                  onCheckedChange={(v) =>
                    setValue("is_active", v === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="cp-active" className="cursor-pointer font-normal">
                  Active
                </Label>
              </div>

              {formState.errors.root?.message ? (
                <p className={fieldErrorCls()} role="alert">
                  {String(formState.errors.root.message)}
                </p>
              ) : null}
            </div>

            <DialogFooter>
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
      {confirmDialog}
    </Card>
  );
}
