import type { PoolConnection } from "mysql2/promise";

/** Update `stock` quantity and append a `stock_movements` row within an open transaction. */
export async function adjustStockConn(
  conn: PoolConnection,
  input: {
    warehouseId: number;
    itemId: number;
    delta: number;
    movementType: string;
    referenceType: string | null;
    referenceId: number | null;
    userId: number | null;
  }
): Promise<void> {
  await conn.query(
    `INSERT IGNORE INTO stock (warehouse_id, item_id, quantity) VALUES (?, ?, 0)`,
    [input.warehouseId, input.itemId]
  );
  await conn.query(
    `UPDATE stock SET quantity = quantity + ? WHERE warehouse_id = ? AND item_id = ?`,
    [input.delta, input.warehouseId, input.itemId]
  );
  await conn.query(
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
}
