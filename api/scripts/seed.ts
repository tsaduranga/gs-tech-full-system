import "dotenv/config";
import bcrypt from "bcrypt";
import { pool } from "../src/db/pool.js";
import { tableHasColumn } from "../src/db/schemaHints.js";
import { PERMISSIONS } from "../src/constants/permissions.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

async function main() {
  for (const key of PERMISSIONS) {
    await pool.query(
      `INSERT IGNORE INTO permissions (\`key\`) VALUES (?)`,
      [key]
    );
  }

  const [roleRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM roles WHERE name = 'Administrator' LIMIT 1`
  );
  let roleId: number;
  if (roleRows[0]) {
    roleId = roleRows[0].id as number;
  } else {
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO roles (name, description) VALUES ('Administrator', 'Full access')`
    );
    roleId = r.insertId as number;
  }

  const [permRows] = await pool.query<RowDataPacket[]>(`SELECT id, \`key\` FROM permissions`);
  const permMap = new Map(permRows.map((p) => [String(p.key), p.id as number]));
  const allIds = PERMISSIONS.map((k) => permMap.get(k)).filter((x): x is number => typeof x === "number");
  await pool.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
  for (const pid of allIds) {
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [
      roleId,
      pid,
    ]);
  }

  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM users WHERE username = 'admin' LIMIT 1`
  );
  let userId: number;
  if (userRows[0]) {
    userId = userRows[0].id as number;
  } else {
    const hash = await bcrypt.hash("Admin123!", 10);
    const [ur] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, is_active)
       VALUES ('admin', 'admin@example.com', ?, 1)`,
      [hash]
    );
    userId = ur.insertId as number;
  }

  await pool.query(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, [
    userId,
    roleId,
  ]);

  await pool.query(
    `INSERT IGNORE INTO warehouses (code, name, is_active) VALUES ('MAIN', 'Main warehouse', 1)`
  );

  try {
    await pool.query(
      `INSERT IGNORE INTO catalog_categories (name, description, sort_order, is_active) VALUES
       ('Beverages', NULL, 10, 1),
       ('Groceries', NULL, 20, 1),
       ('Accessories', NULL, 30, 1),
       ('Office', NULL, 40, 1),
       ('General', NULL, 50, 1)`
    );
    await pool.query(
      `INSERT IGNORE INTO catalog_subcategories (category_id, name, description, sort_order, is_active)
       SELECT c.id, v.name, NULL, v.sort_order, 1 FROM catalog_categories c
       INNER JOIN (
         SELECT 'Beverages' AS cat, 'Hot drinks' AS name, 1 AS sort_order UNION ALL
         SELECT 'Beverages', 'Dairy', 2 UNION ALL
         SELECT 'Groceries', 'Snacks', 1 UNION ALL
         SELECT 'Accessories', 'Cables & peripherals', 1 UNION ALL
         SELECT 'Accessories', 'Computing accessories', 2 UNION ALL
         SELECT 'Office', 'Paper supplies', 1 UNION ALL
         SELECT 'Office', 'Printing supplies', 2 UNION ALL
         SELECT 'General', 'Batteries & power', 1
       ) v ON v.cat = c.name`
    );
  } catch (e) {
    console.warn(
      "catalog_categories / catalog_subcategories seed skipped (run api migrations including 004):",
      e instanceof Error ? e.message : e
    );
  }

  const sampleItems: {
    sku: string;
    name: string;
    category: string | null;
    subcategory: string;
    description: string | null;
    unit_cost: number;
    unit_price: number;
    reorder_level: number;
    initial_qty: number;
  }[] = [
    {
      sku: "DEMO-BEV-ESP-1KG",
      name: "Espresso beans 1 kg",
      category: "Beverages",
      subcategory: "Hot drinks",
      description: "Dark roast, whole bean",
      unit_cost: 18.5,
      unit_price: 28.99,
      reorder_level: 20,
      initial_qty: 45,
    },
    {
      sku: "DEMO-BEV-MILK-2L",
      name: "Whole milk 2 L",
      category: "Beverages",
      subcategory: "Dairy",
      description: "Refrigerated",
      unit_cost: 2.2,
      unit_price: 3.49,
      reorder_level: 48,
      initial_qty: 120,
    },
    {
      sku: "DEMO-GRO-SNACK-12",
      name: "Granola bars (box of 12)",
      category: "Groceries",
      subcategory: "Snacks",
      description: "Assorted flavors",
      unit_cost: 6.0,
      unit_price: 9.99,
      reorder_level: 24,
      initial_qty: 60,
    },
    {
      sku: "DEMO-ACC-USBC-2M",
      name: "USB-C cable 2 m",
      category: "Accessories",
      subcategory: "Cables & peripherals",
      description: "60 W charging / data",
      unit_cost: 4.5,
      unit_price: 12.99,
      reorder_level: 30,
      initial_qty: 80,
    },
    {
      sku: "DEMO-ACC-MOUSE-WL",
      name: "Wireless mouse",
      category: "Accessories",
      subcategory: "Computing accessories",
      description: "USB receiver included",
      unit_cost: 11.0,
      unit_price: 24.99,
      reorder_level: 15,
      initial_qty: 40,
    },
    {
      sku: "DEMO-OFF-PAPER-A4",
      name: "A4 printer paper (500 sheets)",
      category: "Office",
      subcategory: "Paper supplies",
      description: "80 gsm",
      unit_cost: 4.25,
      unit_price: 7.49,
      reorder_level: 40,
      initial_qty: 100,
    },
    {
      sku: "DEMO-OFF-INK-BK",
      name: "Black ink cartridge XL",
      category: "Office",
      subcategory: "Printing supplies",
      description: "Fits common office printers",
      unit_cost: 14.0,
      unit_price: 29.99,
      reorder_level: 10,
      initial_qty: 25,
    },
    {
      sku: "DEMO-GEN-BATT-AA",
      name: "AA alkaline batteries (48 pack)",
      category: "General",
      subcategory: "Batteries & power",
      description: "",
      unit_cost: 12.0,
      unit_price: 19.99,
      reorder_level: 12,
      initial_qty: 36,
    },
  ];

  const legacyCategoryCol = await tableHasColumn("items", "category");
  const legacySubcategoryCol = await tableHasColumn("items", "subcategory_id");

  for (const it of sampleItems) {
    if (legacyCategoryCol) {
      await pool.query(
        `INSERT IGNORE INTO items (sku, name, category, description, unit_cost, unit_price, reorder_level, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          it.sku,
          it.name,
          it.category,
          it.description ?? null,
          it.unit_cost,
          it.unit_price,
          it.reorder_level,
        ]
      );
    } else {
      await pool.query(
        `INSERT IGNORE INTO items (sku, name, description, unit_cost, unit_price, reorder_level, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
        [
          it.sku,
          it.name,
          it.description ?? null,
          it.unit_cost,
          it.unit_price,
          it.reorder_level,
        ]
      );
    }
    if (legacySubcategoryCol) {
      try {
        await pool.query(
          `UPDATE items SET subcategory_id = (
             SELECT s.id FROM catalog_subcategories s
             INNER JOIN catalog_categories c ON c.id = s.category_id
             WHERE c.name = ? AND s.name = ?
             LIMIT 1
           ) WHERE sku = ?`,
          [it.category, it.subcategory, it.sku]
        );
      } catch {
        /* catalog tables may be missing */
      }
    }
  }

  const [wRows] = await pool.query<RowDataPacket[]>(
    `SELECT id FROM warehouses WHERE code = 'MAIN' LIMIT 1`
  );
  const whId = wRows[0]?.id != null ? (wRows[0].id as number) : null;
  if (whId != null) {
    for (const it of sampleItems) {
      await pool.query(
        `INSERT IGNORE INTO stock (warehouse_id, item_id, quantity)
         SELECT ?, id, ? FROM items WHERE sku = ? LIMIT 1`,
        [whId, it.initial_qty, it.sku]
      );
    }
  }

  console.log(
    JSON.stringify({
      seeded: true,
      admin_username: "admin",
      admin_password: "Admin123!",
      warehouse: "MAIN",
      sample_items: sampleItems.map((it) => it.sku),
      note: "Run yarn migrate before seed so migrations include 002 (items.category), 004 (catalog_categories / subcategories / items.subcategory_id). Change admin password after first login.",
    })
  );

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
