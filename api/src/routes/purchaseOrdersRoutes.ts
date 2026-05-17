import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { transactionsModel } from "../models/transactionsModel.js";

export const purchaseOrdersRouter = Router();
purchaseOrdersRouter.use(requireAuth);

const PO_STATUS = ["OPEN", "PARTIAL", "CLOSED", "DRAFT"] as const;

const optionalPositiveId = z.preprocess((v) => {
  const x = Array.isArray(v) ? v[0] : v;
  if (x === undefined || x === "" || x === null) return undefined;
  const n = Number(x);
  return Number.isFinite(n) && n >= 1 ? n : undefined;
}, z.number().int().min(1).optional());

const listQuerySchema = z.object({
  page: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.coerce.number().int().min(1).default(1)
  ),
  pageSize: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.coerce.number().int().min(1).max(500).default(10)
  ),
  q: z.preprocess(
    (v) => (Array.isArray(v) ? v[0] : v),
    z.string().optional()
  ),
  supplier_id: optionalPositiveId,
  status: z.preprocess((v) => {
    const x = Array.isArray(v) ? v[0] : v;
    if (x === undefined || x === "" || x === null) return undefined;
    const u = String(x).trim().toUpperCase();
    return (PO_STATUS as readonly string[]).includes(u) ? u : undefined;
  }, z.enum(PO_STATUS).optional()),
});

purchaseOrdersRouter.get("/", requirePermission("purchase_orders.read"), async (req, res, next) => {
  try {
    const qp = listQuerySchema.parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await transactionsModel.purchaseOrders.listPaginated({
      search: qp.q?.trim() || undefined,
      supplier_id: qp.supplier_id,
      status: qp.status,
      limit: qp.pageSize,
      offset,
    });
    res.json({
      items: rows,
      total,
      page: qp.page,
      pageSize: qp.pageSize,
    });
  } catch (e) {
    next(e);
  }
});

purchaseOrdersRouter.get(
  "/:id/lines",
  requirePermission("purchase_orders.read"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      res.json(await transactionsModel.purchaseOrders.lines(id));
    } catch (e) {
      next(e);
    }
  }
);

purchaseOrdersRouter.post("/", requirePermission("purchase_orders.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        supplier_id: z.number(),
        ordered_at: z.string(),
        lines: z.array(
          z.object({
            item_id: z.number(),
            qty_ordered: z.number().positive(),
            unit_cost: z.number().nonnegative(),
          })
        ),
      })
      .parse(req.body);
    const id = await transactionsModel.purchaseOrders.create({
      supplierId: body.supplier_id,
      orderedAt: body.ordered_at,
      lines: body.lines.map((l) => ({
        itemId: l.item_id,
        qtyOrdered: l.qty_ordered,
        unitCost: l.unit_cost,
      })),
      userId: req.authUser!.id,
    });
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

purchaseOrdersRouter.post(
  "/:id/receive",
  requirePermission("purchase_orders.write"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const body = z
        .object({
          lines: z.array(
            z.object({
              purchase_order_line_id: z.number(),
              qty: z.number().positive(),
            })
          ),
        })
        .parse(req.body);
      const rid = await transactionsModel.purchaseOrders.receive({
        purchaseOrderId: id,
        lines: body.lines.map((l) => ({
          purchaseOrderLineId: l.purchase_order_line_id,
          qty: l.qty,
        })),
        userId: req.authUser!.id,
      });
      res.json({ receipt_id: rid });
    } catch (e) {
      if (e instanceof Error && /Invalid|Receive|No active/.test(e.message)) {
        return next(new HttpError(400, e.message));
      }
      next(e);
    }
  }
);
