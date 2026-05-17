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

type RoleRow = {
  id: number;
  name: string;
  description: string | null;
};

type RoleListResponse = {
  items: RoleRow[];
  total: number;
  page: number;
  pageSize: number;
};

type PermRow = { id: number; key: string; description?: string | null };

type RoleDetailResponse = RoleRow & { permission_ids: number[] };

const PAGE_OPTIONS = [5, 10, 25, 50];

const roleDialogSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters"),
  permissionIds: z.array(z.number().int().positive()),
});

type RoleDialogFormValues = z.infer<typeof roleDialogSchema>;

function fieldErrorCls() {
  return "text-xs text-destructive";
}

export default function RolesPage() {
  const [list, setList] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
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

  const roleFormDefaults: RoleDialogFormValues = useMemo(
    () => ({ name: "", description: "", permissionIds: [] }),
    []
  );

  const roleForm = useForm<RoleDialogFormValues>({
    resolver: zodResolver(roleDialogSchema),
    defaultValues: roleFormDefaults,
    mode: "onTouched",
    reValidateMode: "onChange",
  });

  const { register, watch, setValue, clearErrors, reset, formState, handleSubmit } =
    roleForm;

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const loadRoles = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    const res = await apiJson<RoleListResponse>(`/roles?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load roles");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    void apiJson<PermRow[]>("/roles/permissions").then((r) => {
      if (r.ok && Array.isArray(r.data)) setPerms(r.data as PermRow[]);
    });
  }, []);

  function resetDialogForm() {
    setEditingId(null);
    reset(roleFormDefaults);
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

  async function openEdit(row: RoleRow) {
    setEditingId(row.id);
    reset({
      name: row.name,
      description: row.description ?? "",
      permissionIds: [],
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<RoleDetailResponse>(`/roles/${row.id}`);
    if (res.ok && res.data) {
      reset({
        name: res.data.name,
        description: res.data.description ?? "",
        permissionIds: res.data.permission_ids ?? [],
      });
    }
  }

  const permissionIds = watch("permissionIds");

  function togglePermission(permId: number, checked: boolean) {
    const cur = roleForm.getValues("permissionIds");
    let next: number[];
    if (checked) next = [...new Set([...cur, permId])];
    else next = cur.filter((id) => id !== permId);
    setValue("permissionIds", next, { shouldValidate: true, shouldDirty: true });
  }

  const onSubmitValid: SubmitHandler<RoleDialogFormValues> = async (data) => {
    roleForm.clearErrors("root");
    setSubmitting(true);
    const pidList = data.permissionIds;

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/roles", {
          method: "POST",
          body: JSON.stringify({
            name: data.name.trim(),
            description: data.description.trim() || undefined,
            permission_ids: pidList,
          }),
        });
        if (!res.ok) {
          roleForm.setError("root", {
            type: "server",
            message: res.error ?? "Could not create role",
          });
          setSubmitting(false);
          return;
        }
        setDialogOpen(false);
        resetDialogForm();
        setPage(1);
        await loadRoles();
        setSubmitting(false);
        return;
      }

      const res = await apiJson(`/roles/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: data.name.trim(),
          description:
            data.description.trim() === "" ? null : data.description.trim(),
          permission_ids: pidList,
        }),
      });

      setSubmitting(false);
      if (!res.ok) {
        roleForm.setError("root", {
          type: "server",
          message: res.error ?? "Could not update role",
        });
        return;
      }
      setDialogOpen(false);
      resetDialogForm();
      await loadRoles();
    } catch {
      setSubmitting(false);
      roleForm.setError("root", {
        type: "server",
        message: "Request failed unexpectedly",
      });
    }
  };

  const onSubmitInvalid: SubmitErrorHandler<RoleDialogFormValues> = () => {
    /* validated by resolver; optionally scroll first error into view */
  };

  async function deleteRole(row: RoleRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete role "${row.name}"? Users lose this assignment; permissions are detached.`
      )
    )
      return;
    const res = await apiJson(`/roles/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setListError(res.error ?? "Delete failed");
      return;
    }
    if (list.length <= 1 && page > 1) setPage((p) => p - 1);
    await loadRoles();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Roles</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create roles, assign permissions, and manage access.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add role
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="role-filter">Filter</Label>
            <div className="flex gap-2">
              <Input
                id="role-filter"
                placeholder="Search name or description…"
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
            <Label htmlFor="role-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="role-page-size"
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

        {listError && (
          <p className="text-sm text-destructive" role="alert">
            {listError}
          </p>
        )}

        <div className="relative overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Id</TableHead>
                <TableHead>Name</TableHead>
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
                    No roles match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.description ?? "—"}
                    </TableCell>
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
                          onClick={() => void deleteRole(row)}
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
        <DialogContent showCloseButton className="flex max-h-[min(640px,calc(100vh-4rem))] max-w-full flex-col gap-0 p-1 sm:max-w-lg">
          <form
            onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
            className="flex max-h-[min(620px,calc(100vh-5rem))] flex-col"
          >
            <DialogHeader className="px-4 pt-4">
              <DialogTitle>
                {editingId == null ? "Add role" : "Edit role"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-2 pr-5">
              <div className="grid gap-2">
                <Label htmlFor="r-name">Name</Label>
                <Input
                  id="r-name"
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

              <div className="grid gap-2">
                <Label htmlFor="r-desc">Description</Label>
                <Input
                  id="r-desc"
                  autoComplete="off"
                  aria-invalid={Boolean(formState.errors.description)}
                  className={cn(
                    formState.errors.description && "border-destructive"
                  )}
                  {...register("description")}
                />
                {formState.errors.description?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.description.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label id="perms-label">Permissions</Label>
                <div
                  className="max-h-[220px] space-y-2 overflow-y-auto rounded-md border border-border p-3"
                  role="group"
                  aria-labelledby="perms-label"
                >
                  {perms.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Loading permissions…
                    </p>
                  ) : (
                    perms.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={permissionIds.includes(p.id)}
                          onCheckedChange={(v) =>
                            togglePermission(p.id, v === true)
                          }
                        />
                        <span className="font-mono text-xs">{p.key}</span>
                        {p.description ? (
                          <span className="text-muted-foreground">
                            — {p.description}
                          </span>
                        ) : null}
                      </label>
                    ))
                  )}
                </div>
                {formState.errors.permissionIds?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.permissionIds.message)}
                  </p>
                ) : null}
              </div>

              {formState.errors.root?.message ? (
                <p className={fieldErrorCls()} role="alert">
                  {String(formState.errors.root.message)}
                </p>
              ) : null}
            </div>

            <DialogFooter className="px-4 pb-4 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && (
                  <Loader2Icon className="mr-2 size-4 animate-spin" />
                )}
                {editingId == null ? "Create" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
