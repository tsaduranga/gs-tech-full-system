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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiJson } from "@/lib/api";
import { SearchableNumPicker } from "@/components/searchable-num-picker";

/** Must match api `permissionModel.PERMISSION_KEY_RE`. */
const PERMISSION_KEY_RE = /^([a-z][a-z0-9_]*)(\.[a-z][a-z0-9_]*)+$/;

type PermRow = {
  id: number;
  key: string;
  description: string | null;
};

type PermListResponse = {
  items: PermRow[];
  total: number;
  page: number;
  pageSize: number;
};

type PermDetailResponse = PermRow;

const PAGE_OPTIONS = [5, 10, 25, 50];

const permissionDialogSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2, "Key must be at least 2 characters")
    .max(100)
    .regex(
      PERMISSION_KEY_RE,
      "Use lowercase dot notation, e.g. warehouses.read or purchase_orders.write"
    ),
  description: z.string().trim().max(500, "Description at most 500 characters"),
});

type PermissionDialogValues = z.infer<typeof permissionDialogSchema>;

function fieldErrorCls() {
  return "text-xs text-destructive";
}

export default function PermissionsPage() {
  const [list, setList] = useState<PermRow[]>([]);
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

  const defaults: PermissionDialogValues = useMemo(
    () => ({ key: "", description: "" }),
    []
  );

  const permForm = useForm<PermissionDialogValues>({
    resolver: zodResolver(permissionDialogSchema),
    defaultValues: defaults,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const {
    register,
    clearErrors,
    reset,
    formState,
    handleSubmit,
  } = permForm;

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
    const res = await apiJson<PermListResponse>(`/permissions?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load permissions");
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

  function resetDialogForm() {
    setEditingId(null);
    reset(defaults);
    clearErrors();
  }

  function applyFilter() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  function openCreate() {
    resetDialogForm();
    setDialogOpen(true);
  }

  async function openEdit(row: PermRow) {
    setEditingId(row.id);
    reset({
      key: row.key,
      description: row.description ?? "",
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<PermDetailResponse>(`/permissions/${row.id}`);
    if (res.ok && res.data) {
      reset({
        key: res.data.key,
        description: res.data.description ?? "",
      });
    }
  }

  const onSubmitValid: SubmitHandler<PermissionDialogValues> = async (data) => {
    permForm.clearErrors("root");
    setSubmitting(true);
    const key = data.key.trim();
    const description = data.description.trim() === "" ? null : data.description.trim();

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/permissions", {
          method: "POST",
          body: JSON.stringify({ key, description }),
        });
        if (!res.ok) {
          permForm.setError("root", {
            type: "server",
            message: res.error ?? "Could not create permission",
          });
          setSubmitting(false);
          return;
        }
        setDialogOpen(false);
        resetDialogForm();
        setPage(1);
        await loadList();
        setSubmitting(false);
        return;
      }

      const res = await apiJson(`/permissions/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({ key: data.key.trim(), description }),
      });

      setSubmitting(false);
      if (!res.ok) {
        permForm.setError("root", {
          type: "server",
          message: res.error ?? "Could not update permission",
        });
        return;
      }
      setDialogOpen(false);
      resetDialogForm();
      await loadList();
    } catch {
      setSubmitting(false);
      permForm.setError("root", {
        type: "server",
        message: "Request failed unexpectedly",
      });
    }
  };

  const onSubmitInvalid: SubmitErrorHandler<PermissionDialogValues> = () => {};

  async function deletePerm(row: PermRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete permission "${row.key}"? Roles lose this capability until you assign others.`
      )
    )
      return;
    const res = await apiJson(`/permissions/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setListError(res.error ?? "Delete failed");
      return;
    }
    if (list.length <= 1 && page > 1) setPage((p) => p - 1);
    await loadList();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Permissions</CardTitle>
          <p className="text-sm text-muted-foreground">
            System permission keys mapped to RBAC roles.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add permission
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="perm-filter">Filter</Label>
            <div className="flex gap-2">
              <Input
                id="perm-filter"
                placeholder="Search id, key, or description…"
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
            <Label htmlFor="perm-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="perm-page-size"
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
                <TableHead className="w-16">Id</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="min-w-[200px]">Description</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No permissions match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {row.key}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.description?.trim() ? row.description : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.key}`}
                          onClick={() => void openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row.key}`}
                          className="text-destructive hover:text-destructive"
                          onClick={() => void deletePerm(row)}
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
          if (!open) resetDialogForm();
        }}
      >
        <DialogContent showCloseButton className="sm:max-w-md">
          <form
            onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
            className="flex flex-col gap-4"
          >
            <DialogHeader>
              <DialogTitle>
                {editingId == null ? "Add permission" : "Edit permission"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="perm-key">
                  Key<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="perm-key"
                  className={cn(formState.errors.key && "border-destructive", "font-mono text-sm")}
                  placeholder="e.g. items.write"
                  autoComplete="off"
                  aria-invalid={Boolean(formState.errors.key)}
                  {...register("key")}
                />
                {formState.errors.key?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.key.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="perm-desc">Description</Label>
                <Input
                  id="perm-desc"
                  placeholder="Human-readable explanation (optional)"
                  autoComplete="off"
                  aria-invalid={Boolean(formState.errors.description)}
                  className={cn(formState.errors.description && "border-destructive")}
                  {...register("description")}
                />
                {formState.errors.description?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.description.message)}
                  </p>
                ) : null}
              </div>

              {formState.errors.root?.message ? (
                <p className={fieldErrorCls()} role="alert">
                  {String(formState.errors.root.message)}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
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
