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

type CustomerRow = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
};

type CustomerListResponse = {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
};

type CustomerDetailResponse = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const PAGE_OPTIONS = [5, 10, 25, 50];

function fieldErrorCls() {
  return "text-xs text-destructive";
}

const textareaClass =
  "min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:border-destructive/50";

const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  email: z.union([z.string().trim().email("Invalid email"), z.literal("")]),
  phone: z.string().trim().max(64).optional(),
  address: z.string().trim().max(512).optional(),
  notes: z.string().trim().max(16000).optional(),
  is_active: z.boolean(),
});

type CustomerFormValues = z.infer<typeof customerFormSchema>;

export default function CustomersPage() {
  const [list, setList] = useState<CustomerRow[]>([]);
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

  const defaults = useMemo<CustomerFormValues>(
    () => ({
      name: "",
      email: "",
      phone: "",
      address: "",
      notes: "",
      is_active: true,
    }),
    []
  );

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
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
    const res = await apiJson<CustomerListResponse>(`/customers?${qs.toString()}`);
    setLoading(false);
    if (!res.ok || !res.data?.items) {
      setListError(res.error ?? "Failed to load customers");
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

  async function openEdit(row: CustomerRow) {
    setEditingId(row.id);
    reset({
      name: row.name,
      email: row.email ?? "",
      phone: row.phone ?? "",
      address: row.address ?? "",
      notes: row.notes ?? "",
      is_active: Boolean(row.is_active),
    });
    clearErrors();
    setDialogOpen(true);
    const res = await apiJson<CustomerDetailResponse>(`/customers/${row.id}`);
    if (res.ok && res.data) {
      reset({
        name: res.data.name,
        email: res.data.email ?? "",
        phone: res.data.phone ?? "",
        address: res.data.address ?? "",
        notes: res.data.notes ?? "",
        is_active: Boolean(res.data.is_active),
      });
    }
  }

  function toApiPayload(data: CustomerFormValues) {
    const emailTrim = data.email.trim();
    return {
      name: data.name.trim(),
      email: emailTrim === "" ? null : emailTrim,
      phone: data.phone?.trim() ? data.phone.trim() : null,
      address: data.address?.trim() ? data.address.trim() : null,
      notes: data.notes?.trim() ? data.notes.trim() : null,
      is_active: data.is_active,
    };
  }

  const onSubmitValid: SubmitHandler<CustomerFormValues> = async (data) => {
    form.clearErrors("root");
    setSubmitting(true);
    const payload = toApiPayload(data);

    try {
      if (editingId == null) {
        const res = await apiJson<{ id: number }>("/customers", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          form.setError("root", {
            type: "server",
            message: res.error ?? "Could not create customer",
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

      const res = await apiJson(`/customers/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setSubmitting(false);
      if (!res.ok) {
        form.setError("root", {
          type: "server",
          message: res.error ?? "Could not update customer",
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

  const onSubmitInvalid: SubmitErrorHandler<CustomerFormValues> = () => {};

  async function deleteCustomer(row: CustomerRow) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete customer "${row.name}"?`)
    )
      return;
    const res = await apiJson(`/customers/${row.id}`, { method: "DELETE" });
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
          <CardTitle>Customers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Customer directory for quotations and invoices.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          <PlusIcon className="mr-2 size-4" />
          Add customer
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex max-w-md flex-1 flex-col gap-2">
            <Label htmlFor="cust-filter">Filter</Label>
            <div className="flex gap-2">
              <Input
                id="cust-filter"
                placeholder="Search name, email, phone, or id…"
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
            <Label htmlFor="cust-page-size">Rows per page</Label>
            <SearchableNumPicker
              id="cust-page-size"
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
                <TableHead className="min-w-[140px]">Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="w-[72px]">Active</TableHead>
                <TableHead className="w-[100px]">Updated</TableHead>
                <TableHead className="w-[112px] text-right">Actions</TableHead>
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
                    No rows to display
                  </TableCell>
                </TableRow>
              ) : (
                list.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.id}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.phone ?? "—"}
                    </TableCell>
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
                          onClick={() => void deleteCustomer(row)}
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
          className="flex max-h-[min(90vh,calc(100vh-2rem))] max-w-full flex-col gap-0 overflow-hidden p-1 sm:max-w-lg"
        >
          <form
            className="flex max-h-[min(86vh,calc(100vh-4rem))] flex-col gap-4"
            onSubmit={handleSubmit(onSubmitValid, onSubmitInvalid)}
          >
            <DialogHeader className="shrink-0 px-4 pt-4">
              <DialogTitle>
                {editingId == null ? "Add customer" : "Edit customer"}
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-1">
              <div className="grid gap-2">
                <Label htmlFor="cust-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cust-name"
                  aria-invalid={Boolean(formState.errors.name)}
                  className={cn(formState.errors.name && "border-destructive")}
                  autoComplete="organization"
                  {...register("name")}
                />
                {formState.errors.name?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.name.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  aria-invalid={Boolean(formState.errors.email)}
                  className={cn(formState.errors.email && "border-destructive")}
                  autoComplete="email"
                  {...register("email")}
                />
                {formState.errors.email?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.email.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input
                  id="cust-phone"
                  type="tel"
                  aria-invalid={Boolean(formState.errors.phone)}
                  className={cn(formState.errors.phone && "border-destructive")}
                  autoComplete="tel"
                  {...register("phone")}
                />
                {formState.errors.phone?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.phone.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cust-address">Address</Label>
                <textarea
                  id="cust-address"
                  className={cn(
                    textareaClass,
                    formState.errors.address && "border-destructive"
                  )}
                  aria-invalid={Boolean(formState.errors.address)}
                  {...register("address")}
                />
                {formState.errors.address?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.address.message)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="cust-notes">Notes</Label>
                <textarea
                  id="cust-notes"
                  className={cn(
                    textareaClass,
                    formState.errors.notes && "border-destructive"
                  )}
                  aria-invalid={Boolean(formState.errors.notes)}
                  {...register("notes")}
                />
                {formState.errors.notes?.message ? (
                  <p className={fieldErrorCls()} role="alert">
                    {String(formState.errors.notes.message)}
                  </p>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="cust-active"
                  checked={Boolean(isActiveVal)}
                  onCheckedChange={(v) =>
                    setValue("is_active", v === true, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
                <Label htmlFor="cust-active" className="cursor-pointer font-normal">
                  Active (can be selected on new documents)
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
