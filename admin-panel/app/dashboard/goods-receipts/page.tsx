"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { apiJson } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SearchableNumPicker } from "@/components/searchable-num-picker";

type PoRow = {
  id: number;
  order_number: string;
  supplier_name: string;
  status: string;
};

type PoLineRow = {
  id: number;
  item_id: number;
  sku: string;
  qty_ordered: number | string;
  qty_received: number | string;
  unit_cost: number | string;
};

const underlineInputClass = cn(
  "h-9 w-full max-w-[120px] rounded-none border-0 border-b border-input bg-transparent px-1 text-sm shadow-none",
  "focus-visible:border-ring focus-visible:ring-0 dark:bg-transparent"
);

export default function GoodsReceiptsPage() {
  const [pos, setPos] = useState<PoRow[]>([]);
  const [poLoading, setPoLoading] = useState(true);
  const [poId, setPoId] = useState(0);
  const [lines, setLines] = useState<PoLineRow[]>([]);
  const [recv, setRecv] = useState<Record<number, string>>({});
  const [linesLoading, setLinesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadPos = useCallback(async () => {
    setPoLoading(true);
    const [a, b] = await Promise.all([
      apiJson<{ items: PoRow[] }>("/purchase-orders?page=1&pageSize=200&status=OPEN"),
      apiJson<{ items: PoRow[] }>(
        "/purchase-orders?page=1&pageSize=200&status=PARTIAL"
      ),
    ]);
    const map = new Map<number, PoRow>();
    if (a.ok && a.data?.items)
      for (const r of a.data.items) map.set(r.id, r);
    if (b.ok && b.data?.items)
      for (const r of b.data.items) map.set(r.id, r);
    setPos([...map.values()].sort((x, y) => y.id - x.id));
    setPoLoading(false);
  }, []);

  useEffect(() => {
    void loadPos();
  }, [loadPos]);

  useEffect(() => {
    if (poId < 1) {
      setLines([]);
      setRecv({});
      return;
    }
    let cancelled = false;
    async function run() {
      setLinesLoading(true);
      const res = await apiJson<PoLineRow[]>(`/purchase-orders/${poId}/lines`, {});
      setLinesLoading(false);
      if (cancelled || !res.ok || !Array.isArray(res.data)) {
        if (!cancelled) setLines([]);
        return;
      }
      setLines(res.data);
      const next: Record<number, string> = {};
      for (const ln of res.data) next[ln.id] = "";
      setRecv(next);
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [poId]);

  const poOptions = useMemo(
    () =>
      pos.map((p) => ({
        value: p.id,
        label: `${p.order_number} — ${p.supplier_name} — ${p.status}`,
      })),
    [pos]
  );

  async function submitReceive(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (poId < 1) {
      setMsg("Select a purchase order.");
      return;
    }
    const linePayload: { purchase_order_line_id: number; qty: number }[] = [];
    for (const ln of lines) {
      const q = Number(String(recv[ln.id] ?? "").trim().replace(",", "."));
      if (!Number.isFinite(q) || q <= 0) continue;
      const ordered = Number(ln.qty_ordered);
      const got = Number(ln.qty_received);
      const rem = ordered - got;
      if (q > rem + 1e-9) {
        setMsg(`Line ${ln.sku}: receive qty cannot exceed remaining ${rem}.`);
        return;
      }
      linePayload.push({ purchase_order_line_id: ln.id, qty: q });
    }
    if (linePayload.length === 0) {
      setMsg("Enter quantities to receive on at least one line.");
      return;
    }
    setSubmitting(true);
    const res = await apiJson<{ receipt_id: number }>(
      `/purchase-orders/${poId}/receive`,
      {
        method: "POST",
        body: JSON.stringify({ lines: linePayload }),
      }
    );
    setSubmitting(false);
    if (!res.ok) {
      setMsg(res.error ?? "Receive failed");
      return;
    }
    setMsg(`GRN posted (receipt id ${res.data?.receipt_id ?? "—"})`);
    setPoId(0);
    setLines([]);
    setRecv({});
    void loadPos();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="w-full max-w-6xl border-border/80">
        <CardHeader>
          <CardTitle>Goods receipt (GRN)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Receive stock against an open or partial purchase order (same as{" "}
            <code className="text-xs">POST /purchase-orders/:id/receive</code>
            ).{" "}
            <Link
              href="/dashboard/goods-receipt-history"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              GRN history
            </Link>
            .
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitReceive} className="flex flex-col gap-8">
            <div className="max-w-xl space-y-2">
              <Label htmlFor="grn-po">Purchase order</Label>
              <SearchableNumPicker
                id="grn-po"
                options={poOptions}
                valueId={poId}
                onValueChange={setPoId}
                placeholder={
                  poLoading ? "Loading POs…" : "Pick PO with open quantity…"
                }
                loading={poLoading}
                emptyListHint="No open/partial POs"
                emptyFilterHint="No matches"
                variant="underline"
              />
            </div>

            {linesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading lines…
              </div>
            ) : lines.length > 0 ? (
              <div className="space-y-3">
                <Label className="text-base">Receive quantities</Label>
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="border-b bg-muted/40 text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left">SKU</th>
                        <th className="px-3 py-2 text-right">Ordered</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right">Remaining</th>
                        <th className="px-3 py-2 text-left">Receive now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lines.map((ln) => {
                        const ord = Number(ln.qty_ordered);
                        const got = Number(ln.qty_received);
                        const rem = Math.max(0, ord - got);
                        return (
                          <tr key={ln.id} className="border-b border-border/60">
                            <td className="px-3 py-2 font-mono text-xs">
                              {ln.sku}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {ord}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {got}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {rem}
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                className={underlineInputClass}
                                inputMode="decimal"
                                disabled={rem <= 1e-9}
                                placeholder={rem <= 1e-9 ? "—" : "Qty"}
                                value={recv[ln.id] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setRecv((prev) => ({ ...prev, [ln.id]: v }));
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : poId > 0 ? (
              <p className="text-sm text-muted-foreground">No lines on this PO.</p>
            ) : null}

            <div className="flex max-w-xl flex-col gap-2">
              <Button
                type="submit"
                size="lg"
                disabled={submitting || poId < 1 || lines.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    Posting…
                  </>
                ) : (
                  "Post goods receipt"
                )}
              </Button>
              {msg ? (
                <p
                  className={cn(
                    "text-sm",
                    /^GRN posted/i.test(msg)
                      ? "text-muted-foreground"
                      : "text-destructive"
                  )}
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
