import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../utils/httpError.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { userModel } from "../models/userModel.js";
import { roleModel } from "../models/roleModel.js";
import { pool } from "../db/pool.js";
import type { RowDataPacket } from "mysql2/promise";
import { mastersModel } from "../models/mastersModel.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

usersRouter.get("/", requirePermission("users.read"), async (req, res, next) => {
  try {
    const qp = z
      .object({
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
      })
      .parse(req.query);
    const offset = (qp.page - 1) * qp.pageSize;
    const { rows, total } = await userModel.listPaginated({
      search: qp.q,
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

usersRouter.post("/", requirePermission("users.write"), async (req, res, next) => {
  try {
    const body = z
      .object({
        username: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(8),
        is_active: z.boolean().optional(),
        role_ids: z.array(z.number()).optional(),
      })
      .parse(req.body);
    const id = await userModel.create({
      username: body.username,
      email: body.email,
      password: body.password,
      is_active: body.is_active,
    });
    if (body.role_ids !== undefined)
      await roleModel.setUserRoles(id, body.role_ids);
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

usersRouter.get(
  "/:id/login-history",
  requirePermission("users.read"),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid user id");
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM login_history WHERE user_id = ? ORDER BY id DESC LIMIT 200`,
        [id]
      );
      res.json(rows);
    } catch (e) {
      next(e);
    }
  }
);

usersRouter.post("/:id/roles", requirePermission("roles.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({ role_ids: z.array(z.number()) }).parse(req.body);
    await roleModel.setUserRoles(id, body.role_ids);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/:id/customers", requirePermission("users.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({ customer_ids: z.array(z.number()) }).parse(req.body);
    await mastersModel.customers.assignToUser(id, body.customer_ids);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/:id/suppliers", requirePermission("users.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = z.object({ supplier_ids: z.array(z.number()) }).parse(req.body);
    await mastersModel.suppliers.assignToUser(id, body.supplier_ids);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/:id", requirePermission("users.read"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid user id");
    const row = await userModel.findByIdPublic(id);
    if (!row) throw new HttpError(404, "User not found");
    const role_ids = await roleModel.getUserRoles(id);
    res.json({
      id: row.id,
      username: row.username,
      email: row.email,
      is_active: Boolean(row.is_active),
      created_at: row.created_at,
      updated_at: row.updated_at,
      role_ids,
    });
  } catch (e) {
    next(e);
  }
});

usersRouter.patch("/:id", requirePermission("users.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid user id");
    const exists = await userModel.findByIdPublic(id);
    if (!exists) throw new HttpError(404, "User not found");

    const body = z
      .object({
        email: z.string().email().optional(),
        username: z.string().min(2).optional(),
        password: z.string().min(8).optional(),
        is_active: z.boolean().optional(),
        role_ids: z.array(z.number()).optional(),
      })
      .parse(req.body);

    const patch: Parameters<typeof userModel.update>[1] = {};
    if (body.email !== undefined) patch.email = body.email;
    if (body.username !== undefined) patch.username = body.username;
    if (body.password !== undefined) patch.password = body.password;
    if (body.is_active !== undefined) patch.is_active = body.is_active;
    await userModel.update(id, patch);
    if (body.role_ids !== undefined) await roleModel.setUserRoles(id, body.role_ids);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

usersRouter.delete("/:id", requirePermission("users.write"), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || id < 1) throw new HttpError(400, "Invalid user id");
    if (req.authUser?.id === id) {
      throw new HttpError(403, "You cannot delete your own account");
    }
    const ok = await userModel.deleteUser(id);
    if (!ok) throw new HttpError(404, "User not found");
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
