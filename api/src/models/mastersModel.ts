import type { RowDataPacket, ResultSetHeader } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { tableExists, tableHasColumn } from "../db/schemaHints.js";
import { softDelete, notDeletedClause } from "../db/softDelete.js";

async function insertId(rows: unknown): Promise<number> {
  return (rows as ResultSetHeader).insertId as number;
}

async function itemWarrantySql(): Promise<{ join: string; select: string }> {
  // Warranties are loaded via item_customer_warranties / item_supplier_warranties junction tables.
  return { join: "", select: "" };
}

export const mastersModel = {
  customers: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT * FROM customers WHERE ${notDeletedClause()} ORDER BY id`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const q = opts.search?.trim();
      const conditions = [notDeletedClause("c")];
      const params: unknown[] = [];
      if (q) {
        conditions.push(
          `(c.name LIKE ? OR COALESCE(c.email, '') LIKE ? OR COALESCE(c.phone, '') LIKE ?
            OR COALESCE(c.contact_number, '') LIKE ? OR COALESCE(c.telephone_number, '') LIKE ?
            OR COALESCE(c.whatsapp_number, '') LIKE ? OR COALESCE(c.vat_number, '') LIKE ?
            OR CAST(c.id AS CHAR) LIKE ?)`
        );
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like, like);
      }
      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM customers c ${whereClause}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT c.id, c.name, c.email, c.phone, c.contact_number, c.telephone_number,
                c.whatsapp_number, c.vat_number, c.address, c.notes, c.is_active,
                c.created_at, c.updated_at
         FROM customers c ${whereClause} ORDER BY c.id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows, total };
    },

    async get(id: number): Promise<RowDataPacket | null> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM customers WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
        [id]
      );
      return rows[0] ?? null;
    },
    async create(p: Record<string, unknown>): Promise<number> {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO customers (
           name, email, phone, contact_number, telephone_number, whatsapp_number,
           vat_number, address, notes, is_active
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.name,
          p.email ?? null,
          p.phone ?? null,
          p.contact_number ?? null,
          p.telephone_number ?? null,
          p.whatsapp_number ?? null,
          p.vat_number ?? null,
          p.address ?? null,
          p.notes ?? null,
          p.is_active ?? true,
        ]
      );
      return insertId(r);
    },
    async update(
      id: number,
      patch: Partial<{
        name: string;
        email: string | null;
        phone: string | null;
        contact_number: string | null;
        telephone_number: string | null;
        whatsapp_number: string | null;
        vat_number: string | null;
        address: string | null;
        notes: string | null;
        is_active: boolean;
      }>
    ): Promise<void> {
      const fields: string[] = [];
      const params: unknown[] = [];
      if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
      }
      if (patch.email !== undefined) {
        fields.push("email = ?");
        params.push(patch.email);
      }
      if (patch.phone !== undefined) {
        fields.push("phone = ?");
        params.push(patch.phone);
      }
      if (patch.contact_number !== undefined) {
        fields.push("contact_number = ?");
        params.push(patch.contact_number);
      }
      if (patch.telephone_number !== undefined) {
        fields.push("telephone_number = ?");
        params.push(patch.telephone_number);
      }
      if (patch.whatsapp_number !== undefined) {
        fields.push("whatsapp_number = ?");
        params.push(patch.whatsapp_number);
      }
      if (patch.vat_number !== undefined) {
        fields.push("vat_number = ?");
        params.push(patch.vat_number);
      }
      if (patch.address !== undefined) {
        fields.push("address = ?");
        params.push(patch.address);
      }
      if (patch.notes !== undefined) {
        fields.push("notes = ?");
        params.push(patch.notes);
      }
      if (patch.is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(patch.is_active);
      }
      if (!fields.length) return;
      params.push(id);
      await pool.query(
        `UPDATE customers SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
        params
      );
    },

    async delete(id: number): Promise<boolean> {
      return softDelete("customers", id);
    },
    async assignedForUser(userId: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT c.* FROM customers c
         INNER JOIN user_customers uc ON uc.customer_id = c.id
         WHERE uc.user_id = ? AND ${notDeletedClause("c")}`,
        [userId]
      );
      return rows as RowDataPacket[];
    },
    async assignToUser(userId: number, customerIds: number[]): Promise<void> {
      await pool.query(`DELETE FROM user_customers WHERE user_id = ?`, [userId]);
      for (const cid of customerIds) {
        await pool.query(`INSERT IGNORE INTO user_customers (user_id, customer_id) VALUES (?, ?)`, [
          userId,
          cid,
        ]);
      }
    },
  },
  suppliers: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT * FROM suppliers WHERE ${notDeletedClause()} ORDER BY id`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const q = opts.search?.trim();
      const conditions = [notDeletedClause("s")];
      const params: unknown[] = [];
      if (q) {
        conditions.push(
          `(s.name LIKE ? OR COALESCE(s.email, '') LIKE ? OR COALESCE(s.phone, '') LIKE ?
            OR COALESCE(s.contact_number, '') LIKE ? OR COALESCE(s.telephone_number, '') LIKE ?
            OR COALESCE(s.whatsapp_number, '') LIKE ? OR COALESCE(s.vat_number, '') LIKE ?
            OR CAST(s.id AS CHAR) LIKE ?)`
        );
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like, like);
      }
      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM suppliers s ${whereClause}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.name, s.email, s.phone, s.contact_number, s.telephone_number,
                s.whatsapp_number, s.vat_number, s.address, s.notes, s.is_active,
                s.created_at, s.updated_at
         FROM suppliers s ${whereClause} ORDER BY s.id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows, total };
    },

    async get(id: number): Promise<RowDataPacket | null> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM suppliers WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
        [id]
      );
      return rows[0] ?? null;
    },

    async listActiveBrief(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name FROM suppliers WHERE is_active = 1 AND ${notDeletedClause()} ORDER BY name ASC, id ASC`
      );
      return rows;
    },

    async create(p: Record<string, unknown>): Promise<number> {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO suppliers (
           name, email, phone, contact_number, telephone_number, whatsapp_number,
           vat_number, address, notes, is_active
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          p.name,
          p.email ?? null,
          p.phone ?? null,
          p.contact_number ?? null,
          p.telephone_number ?? null,
          p.whatsapp_number ?? null,
          p.vat_number ?? null,
          p.address ?? null,
          p.notes ?? null,
          p.is_active ?? true,
        ]
      );
      return insertId(r);
    },
    async update(
      id: number,
      patch: Partial<{
        name: string;
        email: string | null;
        phone: string | null;
        contact_number: string | null;
        telephone_number: string | null;
        whatsapp_number: string | null;
        vat_number: string | null;
        address: string | null;
        notes: string | null;
        is_active: boolean;
      }>
    ): Promise<void> {
      const fields: string[] = [];
      const params: unknown[] = [];
      if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
      }
      if (patch.email !== undefined) {
        fields.push("email = ?");
        params.push(patch.email);
      }
      if (patch.phone !== undefined) {
        fields.push("phone = ?");
        params.push(patch.phone);
      }
      if (patch.contact_number !== undefined) {
        fields.push("contact_number = ?");
        params.push(patch.contact_number);
      }
      if (patch.telephone_number !== undefined) {
        fields.push("telephone_number = ?");
        params.push(patch.telephone_number);
      }
      if (patch.whatsapp_number !== undefined) {
        fields.push("whatsapp_number = ?");
        params.push(patch.whatsapp_number);
      }
      if (patch.vat_number !== undefined) {
        fields.push("vat_number = ?");
        params.push(patch.vat_number);
      }
      if (patch.address !== undefined) {
        fields.push("address = ?");
        params.push(patch.address);
      }
      if (patch.notes !== undefined) {
        fields.push("notes = ?");
        params.push(patch.notes);
      }
      if (patch.is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(patch.is_active);
      }
      if (!fields.length) return;
      params.push(id);
      await pool.query(
        `UPDATE suppliers SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
        params
      );
    },

    async delete(id: number): Promise<boolean> {
      return softDelete("suppliers", id);
    },

    async assignToUser(userId: number, supplierIds: number[]): Promise<void> {
      await pool.query(`DELETE FROM user_suppliers WHERE user_id = ?`, [userId]);
      for (const sid of supplierIds) {
        await pool.query(`INSERT IGNORE INTO user_suppliers (user_id, supplier_id) VALUES (?, ?)`, [
          userId,
          sid,
        ]);
      }
    },
  },
  warehouses: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT * FROM warehouses WHERE ${notDeletedClause()} ORDER BY id`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const q = opts.search?.trim();
      const conditions = [notDeletedClause("w")];
      const params: unknown[] = [];
      if (q) {
        conditions.push("(w.code LIKE ? OR w.name LIKE ? OR CAST(w.id AS CHAR) LIKE ?)");
        const like = `%${q}%`;
        params.push(like, like, like);
      }
      const whereClause = `WHERE ${conditions.join(" AND ")}`;
      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c FROM warehouses w ${whereClause}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT w.id, w.code, w.name, w.is_active, w.created_at, w.updated_at
         FROM warehouses w ${whereClause} ORDER BY w.id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows, total };
    },

    async get(id: number): Promise<RowDataPacket | null> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT * FROM warehouses WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
        [id]
      );
      return rows[0] ?? null;
    },

    async create(p: { code: string; name: string; is_active?: boolean }): Promise<number> {
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO warehouses (code, name, is_active) VALUES (?, ?, ?)`,
        [p.code, p.name, p.is_active ?? true]
      );
      return insertId(r);
    },
    async update(
      id: number,
      patch: Partial<{ code: string; name: string; is_active: boolean }>
    ): Promise<void> {
      const fields: string[] = [];
      const params: unknown[] = [];
      if (patch.code !== undefined) {
        fields.push("code = ?");
        params.push(patch.code);
      }
      if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
      }
      if (patch.is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(patch.is_active);
      }
      if (!fields.length) return;
      params.push(id);
      await pool.query(
        `UPDATE warehouses SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
        params
      );
    },

    async delete(id: number): Promise<boolean> {
      return softDelete("warehouses", id);
    },
  },
  items: {
    async list(): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `SELECT * FROM items WHERE ${notDeletedClause()} ORDER BY id`
      );
      return rows as RowDataPacket[];
    },

    async listPaginated(opts: {
      search?: string;
      category?: string;
      catalog_category_id?: number;
      subcategory_id?: number;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const hasCategory = await tableHasColumn("items", "category");
      const hasSubFk = await tableHasColumn("items", "subcategory_id");
      const catJoin =
        hasSubFk &&
        (await tableExists("catalog_categories")) &&
        (await tableExists("catalog_subcategories"));

      const q = opts.search?.trim();
      const conditions: string[] = [notDeletedClause("i")];
      const params: unknown[] = [];

      const categoryFilterExpr = catJoin
        ? hasCategory
          ? "COALESCE(cc.name, i.category, '')"
          : "COALESCE(cc.name, '')"
        : hasCategory
          ? "COALESCE(i.category, '')"
          : "''";

      if (q) {
        if (catJoin) {
          conditions.push(
            "(i.sku LIKE ? OR i.name LIKE ? OR COALESCE(i.description,'') LIKE ? OR COALESCE(s.name,'') LIKE ? OR CAST(i.id AS CHAR) LIKE ?" +
              (hasCategory ? " OR COALESCE(i.category,'') LIKE ? OR COALESCE(cc.name,'') LIKE ?" : " OR COALESCE(cc.name,'') LIKE ?") +
              ")"
          );
          const like = `%${q}%`;
          if (hasCategory) {
            params.push(like, like, like, like, like, like, like);
          } else {
            params.push(like, like, like, like, like, like);
          }
        } else if (hasCategory) {
          conditions.push(
            "(i.sku LIKE ? OR i.name LIKE ? OR COALESCE(i.description,'') LIKE ? OR COALESCE(i.category,'') LIKE ? OR CAST(i.id AS CHAR) LIKE ?)"
          );
          const like = `%${q}%`;
          params.push(like, like, like, like, like);
        } else {
          conditions.push(
            "(i.sku LIKE ? OR i.name LIKE ? OR COALESCE(i.description,'') LIKE ? OR CAST(i.id AS CHAR) LIKE ?)"
          );
          const like = `%${q}%`;
          params.push(like, like, like, like);
        }
      }

      const catalogId =
        opts.catalog_category_id != null && opts.catalog_category_id > 0
          ? opts.catalog_category_id
          : undefined;
      const subId =
        opts.subcategory_id != null && opts.subcategory_id > 0
          ? opts.subcategory_id
          : undefined;

      if (subId != null && hasSubFk && catJoin) {
        conditions.push("i.subcategory_id = ?");
        params.push(subId);
      } else if (catalogId != null && catJoin) {
        if (hasCategory) {
          conditions.push(
            "(s.category_id = ? OR (i.subcategory_id IS NULL AND ccn.id = ?))"
          );
          params.push(catalogId, catalogId);
        } else {
          conditions.push("s.category_id = ?");
          params.push(catalogId);
        }
      } else {
        const cat = opts.category?.trim();
        if (cat && (hasCategory || catJoin)) {
          conditions.push(`${categoryFilterExpr} = ?`);
          params.push(cat);
        }
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const joinSql = catJoin
        ? `LEFT JOIN catalog_subcategories s ON s.id = i.subcategory_id
           LEFT JOIN catalog_categories cc ON cc.id = s.category_id` +
          (hasCategory
            ? ` LEFT JOIN catalog_categories ccn ON ccn.name = i.category AND i.subcategory_id IS NULL`
            : "")
        : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        catJoin
          ? `SELECT COUNT(*) AS c FROM items i ${joinSql} ${whereClause}`
          : `SELECT COUNT(*) AS c FROM items i ${whereClause}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const { join: warrantyJoin, select: warrantySelect } = await itemWarrantySql();

      let selectFields: string;
      if (catJoin && hasCategory) {
        selectFields = `i.id, i.sku, i.name,
          COALESCE(cc.name, i.category) AS category,
          s.name AS subcategory_name,
          COALESCE(s.category_id, ccn.id) AS catalog_category_id,
          i.subcategory_id,
          i.description, i.unit_cost, i.unit_price, i.minimum_price, i.reorder_level, i.is_active, i.created_at, i.updated_at${warrantySelect}`;
      } else if (catJoin && !hasCategory) {
        selectFields = `i.id, i.sku, i.name,
          cc.name AS category,
          s.name AS subcategory_name,
          s.category_id AS catalog_category_id,
          i.subcategory_id,
          i.description, i.unit_cost, i.unit_price, i.minimum_price, i.reorder_level, i.is_active, i.created_at, i.updated_at${warrantySelect}`;
      } else if (hasCategory) {
        selectFields = `i.id, i.sku, i.name, i.category, NULL AS subcategory_name, NULL AS catalog_category_id, NULL AS subcategory_id, i.description, i.unit_cost, i.unit_price, i.minimum_price, i.reorder_level, i.is_active, i.created_at, i.updated_at${warrantySelect}`;
      } else {
        selectFields = `i.id, i.sku, i.name, NULL AS category, NULL AS subcategory_name, NULL AS catalog_category_id, NULL AS subcategory_id, i.description, i.unit_cost, i.unit_price, i.minimum_price, i.reorder_level, i.is_active, i.created_at, i.updated_at${warrantySelect}`;
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${selectFields} FROM items i ${joinSql} ${warrantyJoin} ${whereClause} ORDER BY i.id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows, total };
    },

    /** Distinct non-empty `items.category` values (only when that column exists). */
    async distinctCategories(): Promise<string[]> {
      if (!(await tableHasColumn("items", "category"))) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT category FROM items WHERE category IS NOT NULL AND TRIM(category) <> '' AND ${notDeletedClause()} ORDER BY category`
      );
      return rows.map((r) => String(r.category));
    },

    async get(id: number): Promise<RowDataPacket | null> {
      const hasCategory = await tableHasColumn("items", "category");
      const hasSubFk = await tableHasColumn("items", "subcategory_id");
      const catJoin =
        hasSubFk &&
        (await tableExists("catalog_categories")) &&
        (await tableExists("catalog_subcategories"));

      const joinSql = catJoin
        ? `LEFT JOIN catalog_subcategories s ON s.id = i.subcategory_id
           LEFT JOIN catalog_categories cc ON cc.id = s.category_id` +
          (hasCategory
            ? ` LEFT JOIN catalog_categories ccn ON ccn.name = i.category AND i.subcategory_id IS NULL`
            : "")
        : "";

      const baseCols = hasSubFk
        ? `i.id, i.sku, i.name, i.description, i.unit_cost, i.unit_price, i.minimum_price, i.reorder_level, i.is_active, i.created_at, i.updated_at, i.subcategory_id`
        : `i.id, i.sku, i.name, i.description, i.unit_cost, i.unit_price, i.minimum_price, i.reorder_level, i.is_active, i.created_at, i.updated_at`;
      const { join: warrantyJoin, select: warrantyCols } = await itemWarrantySql();
      const itemCols = `${baseCols}${warrantyCols}`;

      let selectFields: string;
      if (catJoin && hasCategory) {
        selectFields = `${itemCols},
          COALESCE(cc.name, i.category) AS category,
          s.name AS subcategory_name,
          COALESCE(s.category_id, ccn.id) AS catalog_category_id`;
      } else if (catJoin && !hasCategory) {
        selectFields = `${itemCols},
          cc.name AS category,
          s.name AS subcategory_name,
          s.category_id AS catalog_category_id`;
      } else if (hasCategory) {
        selectFields = `${itemCols}, i.category, NULL AS subcategory_name, NULL AS catalog_category_id`;
      } else {
        selectFields = `${itemCols}, NULL AS category, NULL AS subcategory_name, NULL AS catalog_category_id`;
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT ${selectFields} FROM items i ${joinSql} ${warrantyJoin} WHERE i.id = ? AND ${notDeletedClause("i")} LIMIT 1`,
        [id]
      );
      return rows[0] ?? null;
    },

    async create(p: {
      sku: unknown;
      name: unknown;
      category?: unknown;
      description?: unknown;
      unit_cost?: unknown;
      unit_price?: unknown;
      minimum_price?: unknown;
      reorder_level?: unknown;
      is_active?: unknown;
      subcategory_id?: unknown;
    }): Promise<number> {
      const hasCategory = await tableHasColumn("items", "category");
      const hasSubFk = await tableHasColumn("items", "subcategory_id");
      const hasMinimumPrice = await tableHasColumn("items", "minimum_price");

      const cols = ["sku", "name"];
      const vals: unknown[] = [p.sku, p.name];
      if (hasCategory) {
        cols.push("category");
        vals.push(p.category ?? null);
      }
      cols.push("description", "unit_cost", "unit_price");
      vals.push(p.description ?? null, p.unit_cost ?? 0, p.unit_price ?? 0);
      if (hasMinimumPrice) {
        cols.push("minimum_price");
        vals.push(p.minimum_price ?? 0);
      }
      cols.push("reorder_level", "is_active");
      vals.push(p.reorder_level ?? 0, p.is_active ?? true);
      if (hasSubFk) {
        cols.push("subcategory_id");
        vals.push(p.subcategory_id ?? null);
      }
      const placeholders = cols.map(() => "?").join(", ");
      const [r] = await pool.query<ResultSetHeader>(
        `INSERT INTO items (${cols.join(", ")}) VALUES (${placeholders})`,
        vals
      );
      return insertId(r);
    },

    async update(
      id: number,
      patch: Partial<{
        sku: string;
        name: string;
        category: string | null;
        description: string | null;
        unit_cost: number;
        unit_price: number;
        minimum_price: number;
        reorder_level: number;
        is_active: boolean;
        subcategory_id: number | null;
      }>
    ): Promise<void> {
      const hasCategory = await tableHasColumn("items", "category");
      const hasSubFk = await tableHasColumn("items", "subcategory_id");
      const hasMinimumPrice = await tableHasColumn("items", "minimum_price");
      const fields: string[] = [];
      const params: unknown[] = [];
      if (patch.sku !== undefined) {
        fields.push("sku = ?");
        params.push(patch.sku);
      }
      if (patch.name !== undefined) {
        fields.push("name = ?");
        params.push(patch.name);
      }
      if (patch.category !== undefined && hasCategory) {
        fields.push("category = ?");
        params.push(patch.category);
      }
      if (patch.description !== undefined) {
        fields.push("description = ?");
        params.push(patch.description);
      }
      if (patch.unit_cost !== undefined) {
        fields.push("unit_cost = ?");
        params.push(patch.unit_cost);
      }
      if (patch.unit_price !== undefined) {
        fields.push("unit_price = ?");
        params.push(patch.unit_price);
      }
      if (patch.minimum_price !== undefined && hasMinimumPrice) {
        fields.push("minimum_price = ?");
        params.push(patch.minimum_price);
      }
      if (patch.reorder_level !== undefined) {
        fields.push("reorder_level = ?");
        params.push(patch.reorder_level);
      }
      if (patch.is_active !== undefined) {
        fields.push("is_active = ?");
        params.push(patch.is_active);
      }
      if (patch.subcategory_id !== undefined && hasSubFk) {
        fields.push("subcategory_id = ?");
        params.push(patch.subcategory_id);
      }
      if (!fields.length) return;
      params.push(id);
      await pool.query(
        `UPDATE items SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
        params
      );
    },

    async delete(id: number): Promise<boolean> {
      return softDelete("items", id);
    },

    async listSupplierIds(itemId: number): Promise<number[]> {
      if (!(await tableExists("item_suppliers"))) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT isup.supplier_id
         FROM item_suppliers isup
         INNER JOIN suppliers s ON s.id = isup.supplier_id AND ${notDeletedClause("s")}
         WHERE isup.item_id = ?
         ORDER BY s.name ASC, isup.supplier_id ASC`,
        [itemId]
      );
      return rows.map((r) => Number(r.supplier_id));
    },

    async setSuppliers(itemId: number, supplierIds: number[]): Promise<void> {
      if (!(await tableExists("item_suppliers"))) return;
      const unique = [...new Set(supplierIds.filter((id) => Number.isFinite(id) && id >= 1))];
      await pool.query(`DELETE FROM item_suppliers WHERE item_id = ?`, [itemId]);
      for (const sid of unique) {
        await pool.query(
          `INSERT IGNORE INTO item_suppliers (item_id, supplier_id) VALUES (?, ?)`,
          [itemId, sid]
        );
      }
    },

    async listCustomerWarrantyIds(itemId: number): Promise<number[]> {
      if (!(await tableExists("item_customer_warranties"))) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT icw.warranty_id
         FROM item_customer_warranties icw
         INNER JOIN warranties w ON w.id = icw.warranty_id AND ${notDeletedClause("w")}
         WHERE icw.item_id = ?
         ORDER BY w.name ASC, icw.warranty_id ASC`,
        [itemId]
      );
      return rows.map((r) => Number(r.warranty_id));
    },

    async setCustomerWarranties(itemId: number, warrantyIds: number[]): Promise<void> {
      if (!(await tableExists("item_customer_warranties"))) return;
      const unique = [...new Set(warrantyIds.filter((id) => Number.isFinite(id) && id >= 1))];
      await pool.query(`DELETE FROM item_customer_warranties WHERE item_id = ?`, [itemId]);
      for (const wid of unique) {
        await pool.query(
          `INSERT IGNORE INTO item_customer_warranties (item_id, warranty_id) VALUES (?, ?)`,
          [itemId, wid]
        );
      }
    },

    async listSupplierWarrantyIds(itemId: number): Promise<number[]> {
      if (!(await tableExists("item_supplier_warranties"))) return [];
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT isw.warranty_id
         FROM item_supplier_warranties isw
         INNER JOIN warranties w ON w.id = isw.warranty_id AND ${notDeletedClause("w")}
         WHERE isw.item_id = ?
         ORDER BY w.name ASC, isw.warranty_id ASC`,
        [itemId]
      );
      return rows.map((r) => Number(r.warranty_id));
    },

    async setSupplierWarranties(itemId: number, warrantyIds: number[]): Promise<void> {
      if (!(await tableExists("item_supplier_warranties"))) return;
      const unique = [...new Set(warrantyIds.filter((id) => Number.isFinite(id) && id >= 1))];
      await pool.query(`DELETE FROM item_supplier_warranties WHERE item_id = ?`, [itemId]);
      for (const wid of unique) {
        await pool.query(
          `INSERT IGNORE INTO item_supplier_warranties (item_id, warranty_id) VALUES (?, ?)`,
          [itemId, wid]
        );
      }
    },

    async listWarrantyBriefsForItems(itemIds: number[]): Promise<{
      customer: Map<number, { id: number; name: string; warranty_years: number; warranty_months: number }[]>;
      supplier: Map<number, { id: number; name: string; warranty_years: number; warranty_months: number }[]>;
    }> {
      const customer = new Map<
        number,
        { id: number; name: string; warranty_years: number; warranty_months: number }[]
      >();
      const supplier = new Map<
        number,
        { id: number; name: string; warranty_years: number; warranty_months: number }[]
      >();
      if (!itemIds.length) return { customer, supplier };

      const hasCustomer = await tableExists("item_customer_warranties");
      const hasSupplier = await tableExists("item_supplier_warranties");
      const placeholders = itemIds.map(() => "?").join(", ");

      if (hasCustomer) {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT icw.item_id, w.id, w.name, w.warranty_years, w.warranty_months
           FROM item_customer_warranties icw
           INNER JOIN warranties w ON w.id = icw.warranty_id AND ${notDeletedClause("w")}
           WHERE icw.item_id IN (${placeholders})
           ORDER BY icw.item_id ASC, w.name ASC, w.id ASC`,
          itemIds
        );
        for (const r of rows) {
          const itemId = Number(r.item_id);
          const list = customer.get(itemId) ?? [];
          list.push({
            id: Number(r.id),
            name: String(r.name),
            warranty_years: Number(r.warranty_years ?? 0),
            warranty_months: Number(r.warranty_months ?? 0),
          });
          customer.set(itemId, list);
        }
      }

      if (hasSupplier) {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT isw.item_id, w.id, w.name, w.warranty_years, w.warranty_months
           FROM item_supplier_warranties isw
           INNER JOIN warranties w ON w.id = isw.warranty_id AND ${notDeletedClause("w")}
           WHERE isw.item_id IN (${placeholders})
           ORDER BY isw.item_id ASC, w.name ASC, w.id ASC`,
          itemIds
        );
        for (const r of rows) {
          const itemId = Number(r.item_id);
          const list = supplier.get(itemId) ?? [];
          list.push({
            id: Number(r.id),
            name: String(r.name),
            warranty_years: Number(r.warranty_years ?? 0),
            warranty_months: Number(r.warranty_months ?? 0),
          });
          supplier.set(itemId, list);
        }
      }

      return { customer, supplier };
    },
  },

  stock: {
    async listPaginated(opts: {
      warehouse_id?: number;
      search?: string;
      category?: string;
      catalog_category_id?: number;
      subcategory_id?: number;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const hasCategory = await tableHasColumn("items", "category");
      const hasSubFk = await tableHasColumn("items", "subcategory_id");
      const catJoin =
        hasSubFk &&
        (await tableExists("catalog_categories")) &&
        (await tableExists("catalog_subcategories"));

      const joinExtras = catJoin
        ? `LEFT JOIN catalog_subcategories subs ON subs.id = i.subcategory_id
           LEFT JOIN catalog_categories cc ON cc.id = subs.category_id` +
          (hasCategory
            ? ` LEFT JOIN catalog_categories ccn ON ccn.name = i.category AND i.subcategory_id IS NULL`
            : "")
        : "";

      let categorySelect: string;
      if (catJoin && hasCategory) {
        categorySelect = "COALESCE(cc.name, i.category) AS item_category";
      } else if (catJoin && !hasCategory) {
        categorySelect = "cc.name AS item_category";
      } else if (hasCategory) {
        categorySelect = "i.category AS item_category";
      } else {
        categorySelect = "NULL AS item_category";
      }

      const categoryFilterExpr =
        catJoin && hasCategory
          ? "COALESCE(cc.name, i.category, '')"
          : catJoin && !hasCategory
            ? "COALESCE(cc.name, '')"
            : hasCategory
              ? "COALESCE(i.category, '')"
              : null;

      const conditions: string[] = [
        notDeletedClause("i"),
        notDeletedClause("w"),
      ];
      const params: unknown[] = [];

      if (opts.warehouse_id != null && opts.warehouse_id > 0) {
        conditions.push("s.warehouse_id = ?");
        params.push(opts.warehouse_id);
      }

      const q = opts.search?.trim();
      if (q) {
        conditions.push(
          "(i.sku LIKE ? OR i.name LIKE ? OR COALESCE(w.code,'') LIKE ? OR CAST(s.item_id AS CHAR) LIKE ? OR CAST(s.warehouse_id AS CHAR) LIKE ?)"
        );
        const like = `%${q}%`;
        params.push(like, like, like, like, like);
      }

      const catalogId =
        opts.catalog_category_id != null && opts.catalog_category_id > 0
          ? opts.catalog_category_id
          : undefined;
      const subId =
        opts.subcategory_id != null && opts.subcategory_id > 0
          ? opts.subcategory_id
          : undefined;

      if (subId != null && hasSubFk && catJoin) {
        conditions.push("i.subcategory_id = ?");
        params.push(subId);
      } else if (catalogId != null && catJoin) {
        if (hasCategory) {
          conditions.push(
            "(subs.category_id = ? OR (i.subcategory_id IS NULL AND ccn.id = ?))"
          );
          params.push(catalogId, catalogId);
        } else {
          conditions.push("subs.category_id = ?");
          params.push(catalogId);
        }
      } else {
        const cat = opts.category?.trim();
        if (cat && categoryFilterExpr) {
          conditions.push(`${categoryFilterExpr} = ?`);
          params.push(cat);
        }
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const fromSql = `
        FROM stock s
        JOIN items i ON i.id = s.item_id
        JOIN warehouses w ON w.id = s.warehouse_id
        ${joinExtras}
        ${whereClause}`;

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${fromSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.warehouse_id, s.item_id, s.quantity, i.sku, i.name, i.reorder_level, w.code AS warehouse_code, ${categorySelect} ${fromSql} ORDER BY s.warehouse_id ASC, s.item_id ASC LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );
      return { rows: rows as RowDataPacket[], total };
    },

    async listByItemId(itemId: number): Promise<{
      total: number;
      warehouses: {
        warehouse_id: number;
        warehouse_code: string;
        warehouse_name: string;
        quantity: number;
      }[];
    }> {
      const [rows] = await pool.query<RowDataPacket[]>(
        `
        SELECT s.warehouse_id, s.quantity, w.code AS warehouse_code, w.name AS warehouse_name
        FROM stock s
        JOIN items i ON i.id = s.item_id AND ${notDeletedClause("i")}
        JOIN warehouses w ON w.id = s.warehouse_id AND ${notDeletedClause("w")}
        WHERE s.item_id = ?
        ORDER BY w.code ASC`,
        [itemId]
      );

      let total = 0;
      const warehouses = rows.map((r) => {
        const quantity = Number(r.quantity ?? 0);
        total += quantity;
        return {
          warehouse_id: Number(r.warehouse_id),
          warehouse_code: String(r.warehouse_code ?? ""),
          warehouse_name: String(r.warehouse_name ?? r.warehouse_code ?? ""),
          quantity,
        };
      });

      return { total, warehouses };
    },

    async byWarehouse(
      warehouseId: number | null
    ): Promise<RowDataPacket[]> {
      if (!warehouseId) {
        const [rows] = await pool.query(`
          SELECT s.*, i.sku, i.name, i.reorder_level, w.code AS warehouse_code
          FROM stock s
          JOIN items i ON i.id = s.item_id
          JOIN warehouses w ON w.id = s.warehouse_id`);
        return rows as RowDataPacket[];
      }
      const [rows] = await pool.query(
        `
        SELECT s.*, i.sku, i.name, i.reorder_level, w.code AS warehouse_code
        FROM stock s
        JOIN items i ON i.id = s.item_id
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE s.warehouse_id = ?`,
        [warehouseId]
      );
      return rows as RowDataPacket[];
    },

    async lowStock(threshold: number): Promise<RowDataPacket[]> {
      const [rows] = await pool.query(
        `
        SELECT s.*, i.sku, i.name, i.reorder_level, w.code AS warehouse_code
        FROM stock s
        JOIN items i ON i.id = s.item_id
        JOIN warehouses w ON w.id = s.warehouse_id
        WHERE s.quantity <= ?`,
        [threshold]
      );
      return rows as RowDataPacket[];
    },

    async transfer(input: {
      itemId: number;
      fromWarehouseId: number;
      toWarehouseId: number;
      quantity: number;
      userId: number | null;
    }): Promise<void> {
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rowsFrom] = await conn.query<RowDataPacket[]>(
          `SELECT quantity FROM stock WHERE warehouse_id = ? AND item_id = ? FOR UPDATE`,
          [input.fromWarehouseId, input.itemId]
        );
        const qty = Number(rowsFrom[0]?.quantity ?? 0);
        if (qty + 1e-9 < input.quantity) {
          throw new Error("Insufficient stock");
        }
        await conn.query(
          `UPDATE stock SET quantity = quantity - ? WHERE warehouse_id = ? AND item_id = ?`,
          [input.quantity, input.fromWarehouseId, input.itemId]
        );
        await conn.query(
          `INSERT INTO stock (warehouse_id, item_id, quantity)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
          [input.toWarehouseId, input.itemId, input.quantity]
        );
        const [outIns] = await conn.query<ResultSetHeader>(
          `INSERT INTO stock_movements (warehouse_id, item_id, quantity_change, movement_type, reference_type, created_by)
           VALUES (?, ?, ?, 'TRANSFER_OUT', 'TRANSFER', ?)`,
          [
            input.fromWarehouseId,
            input.itemId,
            -input.quantity,
            input.userId,
          ]
        );
        const outMovementId = Number(outIns.insertId ?? 0);
        await conn.query(
          `INSERT INTO stock_movements (warehouse_id, item_id, quantity_change, movement_type, reference_type, reference_id, created_by)
           VALUES (?, ?, ?, 'TRANSFER_IN', 'TRANSFER', ?, ?)`,
          [
            input.toWarehouseId,
            input.itemId,
            input.quantity,
            outMovementId > 0 ? outMovementId : null,
            input.userId,
          ]
        );
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }
    },

    /**
     * Logical transfer rows: pairs TRANSFER_OUT + TRANSFER_IN written in the same
     * INSERT (same `created_at`), opposite `quantity_change`.
     */
    async listTransferHistoryPaginated(opts: {
      search?: string;
      item_id?: number;
      from_warehouse_id?: number;
      to_warehouse_id?: number;
      limit: number;
      offset: number;
    }): Promise<{ rows: RowDataPacket[]; total: number }> {
      const baseSql = `
FROM stock_movements outm
INNER JOIN stock_movements inm
  ON inm.movement_type = 'TRANSFER_IN'
  AND inm.reference_type = 'TRANSFER'
  AND (
    (inm.reference_id IS NOT NULL AND inm.reference_id <> 0 AND inm.reference_id = outm.id)
    OR (
      (inm.reference_id IS NULL OR inm.reference_id = 0)
      AND inm.item_id = outm.item_id
      AND inm.created_at = outm.created_at
      AND inm.quantity_change = -outm.quantity_change
      AND inm.warehouse_id <> outm.warehouse_id
    )
  )
JOIN items i ON i.id = outm.item_id
JOIN warehouses wf ON wf.id = outm.warehouse_id
JOIN warehouses wt ON wt.id = inm.warehouse_id
LEFT JOIN users u ON u.id = outm.created_by
WHERE outm.movement_type = 'TRANSFER_OUT'
  AND outm.reference_type = 'TRANSFER'`;

      const conditions: string[] = [];
      const params: unknown[] = [];

      const q = opts.search?.trim();
      if (q) {
        conditions.push(
          "(i.sku LIKE ? OR i.name LIKE ? OR wf.code LIKE ? OR wt.code LIKE ? OR wf.name LIKE ? OR wt.name LIKE ? OR CAST(outm.item_id AS CHAR) LIKE ? OR CAST(outm.warehouse_id AS CHAR) LIKE ? OR CAST(inm.warehouse_id AS CHAR) LIKE ?)"
        );
        const like = `%${q}%`;
        params.push(like, like, like, like, like, like, like, like, like);
      }
      if (opts.item_id != null && opts.item_id > 0) {
        conditions.push("outm.item_id = ?");
        params.push(opts.item_id);
      }
      if (opts.from_warehouse_id != null && opts.from_warehouse_id > 0) {
        conditions.push("outm.warehouse_id = ?");
        params.push(opts.from_warehouse_id);
      }
      if (opts.to_warehouse_id != null && opts.to_warehouse_id > 0) {
        conditions.push("inm.warehouse_id = ?");
        params.push(opts.to_warehouse_id);
      }

      const filterSql = conditions.length ? ` AND ${conditions.join(" AND ")}` : "";

      const [countRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS c ${baseSql}${filterSql}`,
        params
      );
      const total = Number((countRows[0] as { c?: number })?.c ?? 0);

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT
          outm.id,
          outm.item_id,
          i.sku,
          i.name AS item_name,
          outm.warehouse_id AS from_warehouse_id,
          wf.code AS from_warehouse_code,
          wf.name AS from_warehouse_name,
          inm.warehouse_id AS to_warehouse_id,
          wt.code AS to_warehouse_code,
          wt.name AS to_warehouse_name,
          (-outm.quantity_change) AS quantity,
          outm.created_at,
          outm.created_by,
          u.username AS created_by_username
        ${baseSql}${filterSql}
        ORDER BY outm.created_at DESC, outm.id DESC
        LIMIT ? OFFSET ?`,
        [...params, opts.limit, opts.offset]
      );

      return { rows: rows as RowDataPacket[], total };
    },

    async ensureRow(warehouseId: number, itemId: number): Promise<void> {
      await pool.query(
        `INSERT IGNORE INTO stock (warehouse_id, item_id, quantity) VALUES (?, ?, 0)`,
        [warehouseId, itemId]
      );
    },

    async adjustBy(input: {
      warehouseId: number;
      itemId: number;
      delta: number;
      movementType: string;
      referenceType: string | null;
      referenceId: number | null;
      userId: number | null;
    }): Promise<void> {
      await mastersModel.stock.ensureRow(input.warehouseId, input.itemId);
      await pool.query(
        `UPDATE stock SET quantity = quantity + ? WHERE warehouse_id = ? AND item_id = ?`,
        [input.delta, input.warehouseId, input.itemId]
      );
      await pool.query(
        `INSERT INTO stock_movements (warehouse_id, item_id, quantity_change, movement_type, reference_type, reference_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.warehouseId,
          input.itemId,
          input.delta,
          input.movementType,
          input.referenceType,
          input.referenceId,
          input.userId,
        ]
      );
    },
  },
};
