"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CatalogIdCombobox } from "@/components/catalog-id-combobox";
import { SearchableNumPicker } from "@/components/searchable-num-picker";
import { SearchableStrPicker } from "@/components/searchable-str-picker";

type CustomerBrief = { id: number; name: string };

type UserBrief = {
  id: number;
  username: string;
  is_active?: number | boolean;
};

const STATUS_ON_CREATE = [
  { value: "OPEN", label: "OPEN" },
  { value: "IN_PROGRESS", label: "IN_PROGRESS" },
  { value: "WAITING_PARTS", label: "WAITING_PARTS" },
  { value: "DONE", label: "DONE" },
] as const;

const underlineInputClass = cn(
  "w-full rounded-none border-0 border-b border-input bg-transparent px-1 py-2 text-sm shadow-none",
  "placeholder:text-muted-foreground",
  "focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
);

const underlineTextareaClass = cn(
  underlineInputClass,
  "min-h-[88px] resize-y leading-relaxed"
);

export default function RepairsPage() {
  const [customerId, setCustomerId] = useState(0);
  const [technicianUserId, setTechnicianUserId] = useState(0);
  const [deviceInfo, setDeviceInfo] = useState("");
  const [issueDescription, setIssueDescription] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [msg, setMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customersLoading, setCustomersLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(true);
  const [customers, setCustomers] = useState<CustomerBrief[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCustomersLoading(true);
      setUsersLoading(true);
      const [custRes, userRes] = await Promise.all([
        apiJson<{ items: CustomerBrief[] }>("/customers?page=1&pageSize=500"),
        apiJson<{ items: UserBrief[] }>("/users?page=1&pageSize=500"),
      ]);
      if (cancelled) return;
      if (custRes.ok && Array.isArray(custRes.data?.items))
        setCustomers(custRes.data.items);
      else setCustomers([]);
      if (userRes.ok && Array.isArray(userRes.data?.items)) {
        const list = userRes.data.items.filter(
          (u) => u.is_active === true || u.is_active === 1 || u.is_active === undefined
        );
        setUsers(list);
      } else setUsers([]);
      setCustomersLoading(false);
      setUsersLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const techOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.username} (${u.id})`,
      })),
    [users]
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (customerId < 1) {
      setMsg("Pick a customer.");
      return;
    }

    setSubmitting(true);
    const res = await apiJson<{ id: number }>("/repairs", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId,
        technician_user_id: technicianUserId > 0 ? technicianUserId : null,
        device_info: deviceInfo.trim() || null,
        issue_description: issueDescription.trim() || null,
        status,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.error ?? "Failed to create repair job");
      return;
    }
    setMsg(`Repair job created (id ${res.data?.id ?? "—"})`);
    setCustomerId(0);
    setTechnicianUserId(0);
    setDeviceInfo("");
    setIssueDescription("");
    setStatus("OPEN");
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>New repair job</CardTitle>
          <p className="text-sm text-muted-foreground">
            Log a repair with customer, optional technician assignment, and
            device details.{" "}
            <Link
              href="/dashboard/repair-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Repair history
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="flex flex-col gap-8">
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="r-cust">Customer</Label>
                <CatalogIdCombobox
                  id="r-cust"
                  items={customers.map((c) => ({
                    id: c.id,
                    name: `${c.name} (${c.id})`,
                  }))}
                  valueId={customerId}
                  onValueChange={setCustomerId}
                  placeholder="Search customer…"
                  loading={customersLoading}
                  emptyListHint="No customers"
                  emptyFilterHint="No matching customers"
                  variant="underline"
                />
              </div>
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="r-tech">Technician (optional)</Label>
                <SearchableNumPicker
                  id="r-tech"
                  options={techOptions}
                  valueId={technicianUserId}
                  onValueChange={setTechnicianUserId}
                  placeholder="Unassigned — search users…"
                  loading={usersLoading}
                  emptyListHint="No users (check users.read permission)"
                  emptyFilterHint="No matches"
                  variant="underline"
                />
              </div>
              <div className="min-w-0 space-y-2 sm:col-span-2 xl:col-span-1">
                <Label htmlFor="r-st">Initial status</Label>
                <SearchableStrPicker
                  id="r-st"
                  options={[...STATUS_ON_CREATE]}
                  value={status}
                  onValueChange={(v) => setStatus((v || "OPEN").toUpperCase())}
                  placeholder="Status"
                  allowClear={false}
                />
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="r-device">Device / asset info</Label>
                <textarea
                  id="r-device"
                  value={deviceInfo}
                  onChange={(e) => setDeviceInfo(e.target.value)}
                  placeholder="Model, serial, accessories left with shop…"
                  className={underlineTextareaClass}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-issue">Issue description</Label>
                <textarea
                  id="r-issue"
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  placeholder="What the customer reported, symptoms, notes…"
                  className={underlineTextareaClass}
                  rows={4}
                />
              </div>
            </div>

            <div className="flex max-w-xl flex-col gap-2 pt-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="inline-flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  "Create repair job"
                )}
              </Button>
              {msg ? (
                <p
                  className={cn(
                    "text-sm",
                    /^Repair job created/i.test(msg)
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
                  role="status"
                >
                  {msg}
                </p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
