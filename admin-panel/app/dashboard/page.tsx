"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JsonTable } from "@/components/json-table";
import { apiJson } from "@/lib/api";

type Summary = {
  recent_transactions: Record<string, unknown>[];
  sales_by_day: { d: string; gross: number }[];
  top_selling_products: { sku: string; name: string; qty_sold: number }[];
  low_stock_alerts: Record<string, unknown>[];
  profit_overview: {
    revenue: number;
    cogs: number;
    gross_profit: number;
    months_covered: number;
  };
  employee_performance: Record<string, unknown>[];
  repairs_by_technician: Record<string, unknown>[];
  daily_summary: Record<string, unknown>;
  monthly_summary: Record<string, unknown>;
  sales_by_user: Record<string, unknown>[];
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await apiJson<Summary>("/dashboard/summary");
      if (!res.ok) {
        setErr(res.error ?? "Failed to load dashboard");
        return;
      }
      setSummary(res.data);
    })();
  }, []);

  if (err) {
    return <p className="text-destructive">{err}</p>;
  }

  if (!summary) {
    return <p className="text-muted-foreground">Loading dashboard…</p>;
  }

  const salesChart = summary.sales_by_day.map((r) => ({
    date: String(r.d).slice(5),
    gross: Number(r.gross),
  }));

  const topItems = summary.top_selling_products.map((r) => ({
    name: String(r.sku),
    qty: Number(r.qty_sold),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Sales, inventory alerts, and recent activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {String(summary.daily_summary?.sales_total ?? "0")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This month</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {String(summary.monthly_summary?.sales_total ?? "0")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Gross profit</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {summary.profit_overview.gross_profit.toFixed(2)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              ({summary.profit_overview.months_covered} mo)
            </span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Daily sales (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="gross"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top selling items</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItems}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" fontSize={10} angle={-20} height={56} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="qty" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Low stock alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonTable data={summary.low_stock_alerts} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <JsonTable data={summary.recent_transactions} />
        </CardContent>
      </Card>
    </div>
  );
}
