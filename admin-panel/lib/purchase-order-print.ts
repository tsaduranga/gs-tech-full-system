import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { DEFAULT_COMPANY_PROFILE } from "@/lib/company-profile";
import {
  documentTotals,
  lineAmountExVat,
} from "@/lib/document-totals";
import { formatTaxPercent } from "@/lib/item-pricing";
import { formatWarrantyDisplay } from "@/lib/warranty-format";

export type PurchaseOrderLineDetail = {
  id: number;
  item_id: number;
  sku: string;
  item_name: string;
  qty_ordered: number | string;
  qty_received: number | string;
  unit_cost: number | string;
  supplier_warranty_ids?: number[];
  supplier_warranties?: {
    id: number;
    name: string;
    warranty_years: number;
    warranty_months: number;
  }[];
  supplier_warranty_label?: string;
};

export type PurchaseOrderDetail = {
  id: number;
  supplier_id: number;
  supplier_name: string;
  supplier_address?: string | null;
  supplier_vat_number?: string | null;
  supplier_telephone?: string | null;
  order_number: string;
  status: string;
  ordered_at: string;
  notes: string | null;
  created_by_username: string | null;
  lines: PurchaseOrderLineDetail[];
};

type JsPDFWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

const MARGIN = 10;
const PAGE_W = 210;
const CONTENT_W = PAGE_W - MARGIN * 2;

function num(v: number | string | undefined) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtPdfDate(iso: string | undefined) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}/${m}/${day}`;
  } catch {
    return iso ?? "";
  }
}

function fmtNowStamp() {
  const d = new Date();
  const date = fmtPdfDate(d.toISOString());
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  return `${date} and ${time}`;
}

function fmtMoney(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}

function drawKeyValueBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  rows: [string, string][],
  rowH = 6
) {
  const h = rows.length * rowH + 2;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFontSize(8);
  rows.forEach((row, i) => {
    const ry = y + 4 + i * rowH;
    doc.setFont("helvetica", "bold");
    const label = row[0];
    doc.text(label, x + 2, ry);
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(label);
    const value = row[1] || " ";
    const lines = doc.splitTextToSize(`: ${value}`, w - labelW - 6);
    doc.text(lines, x + 2 + labelW + 1, ry);
  });
  return h;
}

function drawPartyBox(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  title: string,
  rows: [string, string][]
) {
  const rowH = 6;
  const h = 8 + rows.length * rowH;
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(title, x + w / 2, y + 5, { align: "center" });
  doc.line(x, y + 7, x + w, y + 7);
  rows.forEach((row, i) => {
    const ry = y + 11 + i * rowH;
    doc.setFont("helvetica", "bold");
    doc.text(row[0], x + 2, ry);
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(row[0]);
    const valueLines = doc.splitTextToSize(`: ${row[1] || " "}`, w - labelW - 6);
    doc.text(valueLines, x + 2 + labelW + 1, ry);
  });
  return h;
}

export function purchaseOrderTotals(po: PurchaseOrderDetail, vatRate: number) {
  const computedLines = po.lines.map((line) => ({
    qty: num(line.qty_ordered),
    unitExVat: num(line.unit_cost),
  }));
  return documentTotals(computedLines, vatRate, 0);
}

async function loadLogoDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read logo"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function downloadPurchaseOrderPdf(
  po: PurchaseOrderDetail,
  vatRate: number
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const company = DEFAULT_COMPANY_PROFILE;
  const totals = purchaseOrderTotals(po, vatRate);
  const vatLabel = formatTaxPercent(vatRate);
  let y = MARGIN;

  const logoW = 42;
  const logoH = 14;
  const logoData = await loadLogoDataUrl(company.logoUrl);
  if (logoData) {
    doc.addImage(logoData, "PNG", MARGIN, y, logoW, logoH);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(company.name, PAGE_W / 2, y + logoH / 2 + 1.5, { align: "center" });
  y += logoH + 4;

  doc.setFontSize(11);
  doc.rect(MARGIN, y, CONTENT_W, 8);
  doc.text("Purchase Order", PAGE_W / 2, y + 5.5, { align: "center" });
  y += 10;

  const halfW = CONTENT_W / 2 - 1;
  const metaH = Math.max(
    drawKeyValueBox(doc, MARGIN, y, halfW, [
      ["Date of Order", fmtPdfDate(po.ordered_at)],
      ["Due Date", ""],
    ]),
    drawKeyValueBox(doc, MARGIN + halfW + 2, y, halfW, [
      ["PO No", po.order_number],
      ["Status", po.status],
      ["Prepared By", po.created_by_username ?? ""],
    ])
  );
  y += metaH + 2;

  const partyH = Math.max(
    drawPartyBox(doc, MARGIN, y, halfW, "Supplier Details", [
      ["TIN", po.supplier_vat_number ?? ""],
      ["Name", po.supplier_name],
      ["Address", po.supplier_address ?? ""],
      ["Telephone No", po.supplier_telephone ?? ""],
    ]),
    drawPartyBox(doc, MARGIN + halfW + 2, y, halfW, "Purchaser Details", [
      ["TIN", company.tin],
      ["Name", company.name],
      ["Address", company.address],
      ["Telephone No", company.telephone],
    ])
  );
  y += partyH + 2;

  const infoH = drawKeyValueBox(doc, MARGIN, y, CONTENT_W, [
    ["Date of Delivery", ""],
    ["Place of Supply", ""],
    ["Additional Information if any", po.notes ?? ""],
  ]);
  y += infoH + 2;

  const bodyRows: string[][] = po.lines.map((line, idx) => {
    const qty = num(line.qty_ordered);
    const unit = num(line.unit_cost);
    const warrantyLabel =
      line.supplier_warranty_label?.trim() ||
      (line.supplier_warranties ?? [])
        .map((w) =>
          formatWarrantyDisplay(w.name, w.warranty_years, w.warranty_months)
        )
        .join(", ");
    const desc = warrantyLabel
      ? `${line.sku} — ${line.item_name}\nWarranties: ${warrantyLabel}`
      : `${line.sku} — ${line.item_name}`;
    return [
      String(idx + 1),
      desc,
      fmtMoney(qty),
      fmtMoney(unit),
      fmtMoney(lineAmountExVat(qty, unit)),
    ];
  });
  while (bodyRows.length < 8) {
    bodyRows.push(["", "", "", "", ""]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: "grid",
    head: [
      [
        "Ref.",
        "Description of Goods or Services",
        "Quantity",
        "Unit Price",
        "Amount Excluding VAT (Rs.)",
      ],
    ],
    body: bodyRows,
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
      textColor: [0, 0, 0],
      valign: "middle",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });

  const tableDoc = doc as JsPDFWithAutoTable;
  let totalsY = (tableDoc.lastAutoTable?.finalY ?? y) + 1;

  autoTable(doc, {
    startY: totalsY,
    margin: { left: MARGIN + CONTENT_W * 0.42, right: MARGIN },
    theme: "grid",
    body: [
      ["Total Value of Supply", fmtMoney(totals.totalExVat)],
      [
        `VAT Amount (Total Value of Supply @ ${vatLabel}%)`,
        fmtMoney(totals.vatAmount),
      ],
      ["Total Amount including VAT", fmtMoney(totals.totalIncVat)],
      ["Delivery Charges", fmtMoney(totals.deliveryCharges)],
      [
        "Total Amount including Delivery Charges",
        fmtMoney(totals.grandTotal),
      ],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 1.5,
      lineColor: [0, 0, 0],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 78 },
      1: { halign: "right", cellWidth: 32 },
    },
    didParseCell(data) {
      if (data.row.index === 4) {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  totalsY = (tableDoc.lastAutoTable?.finalY ?? totalsY) + 8;

  const sigW = CONTENT_W / 4;
  const sigLabels = [
    "Prepared By",
    "Checked By",
    "Authorised By",
    "Received By & Company Stamp",
  ];
  sigLabels.forEach((label, i) => {
    const sx = MARGIN + i * sigW;
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label, sx + sigW / 2, totalsY, { align: "center" });
    doc.text("........................", sx + sigW / 2, totalsY + 7, {
      align: "center",
    });
    if (i === 3) {
      doc.setFontSize(6);
      doc.text("Name :", sx + 2, totalsY + 12);
      doc.text("Date :", sx + 2, totalsY + 16);
    }
  });

  totalsY += 24;
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(`Payment Communication: ${po.order_number}`, MARGIN, totalsY);
  totalsY += 4;
  doc.setFont("helvetica", "normal");
  const terms = [
    "Please supply goods as per this purchase order.",
    "Delivery must be accompanied by a delivery note and supplier invoice.",
    "Any variation in price or quantity must be approved in writing before supply.",
  ];
  terms.forEach((line) => {
    totalsY += 4;
    doc.text(`• ${line}`, MARGIN + 2, totalsY);
  });

  doc.setFontSize(6);
  doc.text(
    `System Generated Print ${fmtNowStamp()} . Powered BY GS Tech POS.`,
    PAGE_W / 2,
    290,
    { align: "center" }
  );

  const safeName = po.order_number.replace(/[^\w.-]+/g, "_");
  doc.save(`${safeName}.pdf`);
}

/** @deprecated Use downloadPurchaseOrderPdf */
export async function printPurchaseOrderPdf(
  po: PurchaseOrderDetail,
  vatRate: number
) {
  await downloadPurchaseOrderPdf(po, vatRate);
}
