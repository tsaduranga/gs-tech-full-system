"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonTable } from "@/components/json-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiJson } from "@/lib/api";

type TabKey =
  | "sales"
  | "payment"
  | "emp"
  | "inv"
  | "p_sup"
  | "p_sum"
  | "repair"
  | "cash"
  | "pl";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sales", label: "Sales (daily)" },
  { key: "payment", label: "By payment" },
  { key: "emp", label: "By employee" },
  { key: "inv", label: "Inventory" },
  { key: "p_sup", label: "Purch. supplier" },
  { key: "p_sum", label: "Purch. summary" },
  { key: "repair", label: "Repairs" },
  { key: "cash", label: "Daily cash" },
  { key: "pl", label: "P&L" },
];

export default function ReportsPage() {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);
  const [scalar, setScalar] = useState<Record<string, unknown> | null>(null);
  const [tab, setTab] = useState<TabKey>("sales");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(k: TabKey) {
    setTab(k);
    setErr(null);
    setScalar(null);
    setRows(null);
    setLoading(true);
    const paths: Record<TabKey, string> = {
      sales: "/reports/sales?granularity=daily",
      payment: "/reports/sales/by-payment-method",
      emp: "/reports/sales/by-employee",
      inv: "/reports/inventory/current-stock",
      p_sup: "/reports/purchases/by-supplier",
      p_sum: "/reports/purchases/summary",
      repair: "/reports/repairs/jobs",
      cash: "/reports/financial/daily-cash",
      pl: "/reports/financial/pl?months=1",
    };
    const res = await apiJson<unknown>(paths[k]);
    setLoading(false);
    if (!res.ok) {
      setErr(res.error ?? "Failed");
      return;
    }
    if (
      k === "pl" &&
      res.data &&
      typeof res.data === "object" &&
      !Array.isArray(res.data)
    ) {
      setScalar(res.data as Record<string, unknown>);
      return;
    }
    if (Array.isArray(res.data)) {
      setRows(res.data as Record<string, unknown>[]);
      return;
    }
    setRows([]);
  }

  useEffect(() => {
    void load("sales");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Reports</CardTitle>
        <Button size="sm" variant="outline" onClick={() => load(tab)} disabled={loading}>
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Button
              key={t.key}
              type="button"
              size="sm"
              variant={tab === t.key ? "default" : "outline"}
              className={cn(tab === t.key && "pointer-events-none")}
              onClick={() => load(t.key)}
              disabled={loading}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {err && <p className="text-destructive">{err}</p>}
        {loading && <p className="text-muted-foreground">Loading…</p>}

        {!loading && scalar && (
          <pre className="overflow-x-auto rounded-md border border-border p-4 text-xs">
            {JSON.stringify(scalar, null, 2)}
          </pre>
        )}
        {!loading && !scalar && <JsonTable data={rows ?? []} />}
      </CardContent>
    </Card>
  );
}
