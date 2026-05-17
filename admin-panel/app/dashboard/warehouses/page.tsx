"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useForm,
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
import { SearchableNumPicker } from "@/components/searchable-num-picker";

/** Align with api `codeSchema`. */
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

type WarehouseRow = {
  id: number;
  code: string;
  name: string;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

type WarehouseListResponse = {
  items: WarehouseRow[];
  total: number;
  page: number;
  pageSize: number;
};

type WarehouseDetailResponse = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PAGE_OPTIONS = [5, 10, 25, 50];

function fieldErrorCls() {
  return "text-xs text-destructive";
}

const warehouseFormSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(50)
    .regex(
      CODE_RE,
      "Use letters, numbers, hyphens, or underscores; must start with a letter or digit"
    ),
  name: z.string().trim().min(1, "Name is required").max(255),
  is_active: z.boolean(),
});

type WarehouseFormValues = z.infer<typeof warehouseFormSchema>;

export default function WarehousesPage() {
  const [list, setList] = useState<WarehouseRow[]>([]);
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

  const defaults = useMemo<WarehouseFormValues>(
    () => ({
      code: "",
      name: "",
      is_active: true,
    }),
    []
  );

  const form = useForm<WarehouseFormValues>({
    resolver: zodResolver(warehouseFormSchema),
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
    const res = await apiJson<WarehouseListResponse>(`/warehouses?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load warehouses");
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

  async function openEdit(row: WarehouseRow) {
    setEditingId(row.id);
    reset({
      code: row.code,
      name: row.name,
      is_active: Boolean(row.is_active),
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<WarehouseDetailResponse>(`/warehouses/${row.id}`);
    if (res.ok && res.data) {
      reset({
        code: res.data.code,
        name: res.data.name,
        is_active: Boolean(res.data.is_active),
      });
    }
  }

  const onSubmitValid: SubmitHandler<WarehouseFormValues> = async (data) => {
    form.clearErrors("root");
    setSubmitting(true);
    const payload = {
      code: data.code.trim(),
      name: data.name.trim(),
      is_active: data.is_active,
    };

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/warehouses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          form.setError("root", {
            type: "server",
            message: res.error ?? "Could not create warehouse",
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

      const res = await apiJson(`/warehouses/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setSubmitting(false);
      if (!res.ok) {
        form.setError("root", {
          type: "server",
          message: res.error ?? "Could not update warehouse",
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

  const onSubmitInvalid: SubmitErrorHandler<WarehouseFormValues> = () => {};

  async function deleteWarehouse(row: WarehouseRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete warehouse "${row.code}" — ${row.name}?`)
    )
      return;
    const res = await apiJson(`/warehouses/${row.id}`, { method: "DELETE" });
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
          <CardTitle>Warehouses</CardTitle>
          <p className="text-sm text-muted-foreground">
            Storage locations for stock and movements.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add warehouse
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="wh-filter">Filter</Label>
            <div className="flex gap-2">
              <Input
                id="wh-filter"
                placeholder="Search code, name, or id…"
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
            <Label htmlFor="wh-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="wh-page-size"
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
                <TableHead className="w-[100px]">Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[72px]">Active</TableHead>
                <TableHead className="w-[100px]">Updated</TableHead>
                <TableHead className="w-[112px] text-right">Actions</TableHead>
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
                    <TableCell className="font-mono text-sm font-medium">
                      {row.code}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{Boolean(row.is_active) ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {fmt(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.code}`}
                          onClick={() => void openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row.code}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => void deleteWarehouse(row)}
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
        <DialogContent showCloseButton className="sm:max-w-md">
          <form
            className="flex flex-col gap-4"
            onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
          >
            <DialogHeader>
              <DialogTitle>
                {editingId == null ? "Add warehouse" : "Edit warehouse"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="wh-code">
                  Code<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wh-code"
                  className={cn(
                    "font-mono text-sm",
                    formState.errors.code && "border-destructive"
                  )}
                  placeholder="e.g. MAIN"
                  autoComplete="off"
                  aria-invalid={Boolean(formState.errors.code)}
                  {...register("code")}
                />
                {formState.errors.code?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.code.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="wh-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wh-name"
                  aria-invalid={Boolean(formState.errors.name)}
                  className={cn(formState.errors.name && "border-destructive")}
                  autoComplete="off"
                  {...register("name")}
                />
                {formState.errors.name?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.name.message)}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="wh-active"
                  checked={Boolean(isActiveVal)}
                  onCheckedChange={(v) =>
                    setValue("is_active", v === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="wh-active" className="cursor-pointer font-normal">
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
    </Card>
  );
}
