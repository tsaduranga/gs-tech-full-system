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
import { getStoredUser } from "@/lib/auth-storage";
import { SearchableNumPicker } from "@/components/searchable-num-picker";

type UserRow = {
  id: number;
  username: string;
  email: string;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

type UserListResponse = {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
};

type RoleRow = { id: number; name: string; description: string | null };

type RoleListResponse = {
  items: RoleRow[];
  total: number;
  page: number;
  pageSize: number;
};

type UserDetailResponse = {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  role_ids: number[];
};

const PAGE_OPTIONS = [5, 10, 25, 50];

function fieldErrorCls() {
  return "text-xs text-destructive";
}

function userDialogSchema(isCreate: boolean) {
  return z
    .object({
      username: z
        .string()
        .trim()
        .min(2, "Username must be at least 2 characters")
        .max(100, "Username must be at most 100 characters"),
      email: z.string().email("Invalid email"),
      password: z.string(),
      is_active: z.boolean(),
      roleIds: z.array(z.number().int().positive()),
    })
    .superRefine((data, ctx) => {
      const p = data.password.trim();
      if (isCreate) {
        if (p.length < 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["password"],
            message: "Password must be at least 8 characters",
          });
        }
      } else if (p.length > 0 && p.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["password"],
          message: "Leave blank or use at least 8 characters",
        });
      }
    });
}

type UserDialogFormValues = z.infer<ReturnType<typeof userDialogSchema>>;

const EMPTY_USER_VALUES: UserDialogFormValues = {
  username: "",
  email: "",
  password: "",
  is_active: true,
  roleIds: [],
};

type UserDialogFormProps = {
  editingId: number | null;
  seedRow: UserRow | null;
  roles: RoleRow[];
  onCancel: () => void;
  onComplete: (created: boolean) => void;
};

/** Keyed by `editingId` so resolver (create vs edit) matches UI. */
function UserDialogForm({
  editingId,
  seedRow,
  roles,
  onCancel,
  onComplete,
}: UserDialogFormProps) {
  const isCreate = editingId === null;
  const [submitting, setSubmitting] = useState(false);

  const userForm = useForm<UserDialogFormValues>({
    resolver: zodResolver(userDialogSchema(isCreate)),
    defaultValues: EMPTY_USER_VALUES,
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
  } = userForm;

  useEffect(() => {
    clearErrors();

    if (isCreate || editingId == null) {
      reset(EMPTY_USER_VALUES);
      return;
    }

    if (seedRow && seedRow.id === editingId) {
      reset({
        username: seedRow.username,
        email: seedRow.email,
        password: "",
        is_active: Boolean(seedRow.is_active),
        roleIds: [],
      });
    }

    let cancelled = false;
    void apiJson<UserDetailResponse>(`/users/${editingId}`).then((res) => {
      if (cancelled || !res.ok || !res.data) return;
      reset({
        username: res.data.username,
        email: res.data.email,
        password: "",
        is_active: Boolean(res.data.is_active),
        roleIds: res.data.role_ids ?? [],
      });
    });
    return () => {
      cancelled = true;
    };
  }, [isCreate, editingId, seedRow, reset, clearErrors]);

  const roleIds = watch("roleIds");
  const isActive = watch("is_active");

  function toggleRole(roleId: number, checked: boolean) {
    const cur = userForm.getValues("roleIds");
    let next: number[];
    if (checked) next = [...new Set([...cur, roleId])];
    else next = cur.filter((id) => id !== roleId);
    setValue("roleIds", next, { shouldValidate: true, shouldDirty: true });
  }

  const onSubmitValid: SubmitHandler<UserDialogFormValues> = async (data) => {
    userForm.clearErrors("root");
    setSubmitting(true);
    const role_ids = data.roleIds;
    const payloadBase = {
      username: data.username.trim(),
      email: data.email.trim(),
      is_active: data.is_active,
      role_ids,
    };
    const pw = data.password.trim();

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/users", {
          method: "POST",
          body: JSON.stringify({
            ...payloadBase,
            password: pw,
          }),
        });
        if (!res.ok) {
          userForm.setError("root", {
            type: "server",
            message: res.error ?? "Could not create user",
          });
          setSubmitting(false);
          return;
        }
        onComplete(true);
        setSubmitting(false);
        return;
      }

      const patch: Record<string, unknown> = { ...payloadBase };
      if (pw) patch.password = pw;

      const res = await apiJson(`/users/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });

      setSubmitting(false);
      if (!res.ok) {
        userForm.setError("root", {
          type: "server",
          message: res.error ?? "Could not update user",
        });
        return;
      }
      onComplete(false);
    } catch {
      setSubmitting(false);
      userForm.setError("root", {
        type: "server",
        message: "Request failed unexpectedly",
      });
    }
  };

  const onSubmitInvalid: SubmitErrorHandler<UserDialogFormValues> = () => {};

  return (
    <form
      onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
      className="flex max-h-[min(620px,calc(100vh-5rem))] flex-col"
    >
      <DialogHeader className="px-4 pt-4">
        <DialogTitle>
          {editingId == null ? "Add user" : "Edit user"}
        </DialogTitle>
      </DialogHeader>

      <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-2 pr-5">
        <div className="grid gap-2">
          <Label htmlFor="u-username">Username</Label>
          <Input
            id="u-username"
            autoComplete="off"
            aria-invalid={Boolean(formState.errors.username)}
            className={cn(formState.errors.username && "border-destructive")}
            {...register("username")}
          />
          {formState.errors.username?.message ? (
            <p className={fieldErrorCls()} role="alert">
              {String(formState.errors.username.message)}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="u-email">Email</Label>
          <Input
            id="u-email"
            type="email"
            autoComplete="off"
            aria-invalid={Boolean(formState.errors.email)}
            className={cn(formState.errors.email && "border-destructive")}
            {...register("email")}
          />
          {formState.errors.email?.message ? (
            <p className={fieldErrorCls()} role="alert">
              {String(formState.errors.email.message)}
            </p>
          ) : null}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="u-password">
            Password
            {editingId != null ? (
              <span className="ml-1 font-normal text-muted-foreground">
                (leave blank to keep current)
              </span>
            ) : null}
          </Label>
          <Input
            id="u-password"
            type="password"
            autoComplete={editingId == null ? "new-password" : "off"}
            aria-invalid={Boolean(formState.errors.password)}
            className={cn(formState.errors.password && "border-destructive")}
            {...register("password")}
          />
          {formState.errors.password?.message ? (
            <p className={fieldErrorCls()} role="alert">
              {String(formState.errors.password.message)}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="u-active"
            checked={Boolean(isActive)}
            onCheckedChange={(v) =>
              setValue("is_active", v === true, {
                shouldValidate: true,
                shouldDirty: true,
              })
            }
          />
          <Label htmlFor="u-active" className="cursor-pointer font-normal">
            Account active
          </Label>
        </div>

        <div className="grid gap-2">
          <Label id="roles-label">Roles</Label>
          <div
            className="max-h-[220px] space-y-2 overflow-y-auto rounded-md border border-border p-3"
            role="group"
            aria-labelledby="roles-label"
          >
            {roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading roles…</p>
            ) : (
              roles.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={roleIds.includes(r.id)}
                    onCheckedChange={(v) => toggleRole(r.id, v === true)}
                  />
                  <span className="font-medium">{r.name}</span>
                  {r.description ? (
                    <span className="text-muted-foreground">
                      — {r.description}
                    </span>
                  ) : null}
                </label>
              ))
            )}
          </div>
          {formState.errors.roleIds?.message ? (
            <p className={fieldErrorCls()} role="alert">
              {String(formState.errors.roleIds.message)}
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
        <Button type="button" variant="outline" onClick={onCancel}>
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
  );
}

export default function UsersPage() {
  const [list, setList] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filterInput, setFilterInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [seedRow, setSeedRow] = useState<UserRow | null>(null);

  useEffect(() => {
    setCurrentUserId(getStoredUser()?.id ?? null);
  }, []);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize]
  );

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const qs = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (activeQuery.trim()) qs.set("q", activeQuery.trim());
    const res = await apiJson<UserListResponse>(`/users?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load users");
      setList([]);
      setTotal(0);
      return;
    }
    setList(res.data.items);
    setTotal(res.data.total);
  }, [page, pageSize, activeQuery]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    void apiJson<RoleListResponse>("/roles?page=1&pageSize=200").then((r) => {
      if (r.ok && r.data?.items) setRoles(r.data.items);
    });
  }, []);

  function resetDialogState() {
    setEditingId(null);
    setSeedRow(null);
  }

  function applyFilter() {
    setPage(1);
    setActiveQuery(filterInput.trim());
  }

  function openCreate() {
    resetDialogState();
    setDialogOpen(true);
  }

  function openEdit(row: UserRow) {
    setEditingId(row.id);
    setSeedRow(row);
    setDialogOpen(true);
  }

  async function deleteUser(row: UserRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete user "${row.username}"? This cannot be undone.`)
    )
      return;
    const res = await apiJson(`/users/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      setListError(res.error ?? "Delete failed");
      return;
    }
    if (list.length <= 1 && page > 1) setPage((p) => p - 1);
    await loadUsers();
  }

  function formatTs(iso: string) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Users</CardTitle>
          <p className="text-sm text-muted-foreground">
            Create accounts, assign roles, and manage access.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add user
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="user-filter">Filter</Label>
            <div className="flex gap-2">
              <Input
                id="user-filter"
                placeholder="Search id, username, or email…"
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
            <Label htmlFor="user-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="user-page-size"
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
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24">Active</TableHead>
                <TableHead className="min-w-[140px]">Created</TableHead>
                <TableHead className="min-w-[140px]">Updated</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
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
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No users match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-medium">{row.username}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.email}
                    </TableCell>
                    <TableCell>{Boolean(row.is_active) ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTs(row.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatTs(row.updated_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${row.username}`}
                          onClick={() => openEdit(row)}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${row.username}`}
                          disabled={currentUserId === row.id}
                          title={
                            currentUserId === row.id
                              ? "You cannot delete your own account"
                              : undefined
                          }
                          className="text-destructive hover:text-destructive disabled:opacity-40"
                          onClick={() => void deleteUser(row)}
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
          if (!open) resetDialogState();
        }}
      >
        <DialogContent
          showCloseButton
          className="flex max-h-[min(640px,calc(100vh-4rem))] max-w-full flex-col gap-0 p-1 sm:max-w-lg"
        >
          {dialogOpen ? (
            <UserDialogForm
              key={editingId ?? "create"}
              editingId={editingId}
              seedRow={seedRow}
              roles={roles}
              onCancel={() => {
                setDialogOpen(false);
                resetDialogState();
              }}
              onComplete={(created) => {
                setDialogOpen(false);
                resetDialogState();
                if (created) setPage(1);
                void loadUsers();
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
