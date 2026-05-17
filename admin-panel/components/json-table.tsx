"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object")
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  return String(v);
}

export function JsonTable({
  data,
}: {
  data: Record<string, unknown>[] | null | undefined;
}) {
  if (!data?.length) {
    return (
      <p className="text-sm text-muted-foreground">No rows to display.</p>
    );
  }
  const keys = Object.keys(data[0]!);
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {keys.map((k) => (
              <TableHead key={k} className="whitespace-nowrap">
                {k}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i}>
              {keys.map((k) => (
                <TableCell key={k} className="max-w-[320px] truncate">
                  {stringifyCell(row[k])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
