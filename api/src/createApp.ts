import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authRouter } from "./routes/authRoutes.js";
import { usersRouter } from "./routes/usersRoutes.js";
import { rolesRouter } from "./routes/rolesRoutes.js";
import { permissionsRouter } from "./routes/permissionsRoutes.js";
import { customersRouter } from "./routes/customersRoutes.js";
import { suppliersRouter } from "./routes/suppliersRoutes.js";
import { warehousesRouter } from "./routes/warehousesRoutes.js";
import { itemsRouter } from "./routes/itemsRoutes.js";
import { categoriesRouter } from "./routes/categoriesRoutes.js";
import { subcategoriesRouter } from "./routes/subcategoriesRoutes.js";
import { stockRouter } from "./routes/stockRoutes.js";
import { purchaseOrdersRouter } from "./routes/purchaseOrdersRoutes.js";
import { quotationsRouter } from "./routes/quotationsRoutes.js";
import { invoicesRouter } from "./routes/invoicesRoutes.js";
import { repairsRouter } from "./routes/repairsRoutes.js";
import { salesOrdersRouter } from "./routes/salesOrdersRoutes.js";
import { goodsReceiptsRouter } from "./routes/goodsReceiptsRoutes.js";
import { supplierReturnsRouter } from "./routes/supplierReturnsRoutes.js";
import { customerReturnsRouter } from "./routes/customerReturnsRoutes.js";
import { dashboardRouter } from "./routes/dashboardRoutes.js";
import { reportsRouter } from "./routes/reportsRoutes.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(",").map((s) => s.trim().replace(/\/$/, "")),
      credentials: true,
    })
  );
  app.use(express.json({ limit: "1mb" }));

  const loginLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", loginLimiter, authRouter);
  app.use("/users", usersRouter);
  app.use("/roles", rolesRouter);
  app.use("/permissions", permissionsRouter);
  app.use("/customers", customersRouter);
  app.use("/suppliers", suppliersRouter);
  app.use("/warehouses", warehousesRouter);
  app.use("/items", itemsRouter);
  app.use("/categories", categoriesRouter);
  app.use("/subcategories", subcategoriesRouter);
  app.use("/stock", stockRouter);
  app.use("/purchase-orders", purchaseOrdersRouter);
  app.use("/quotations", quotationsRouter);
  app.use("/invoices", invoicesRouter);
  app.use("/repairs", repairsRouter);
  app.use("/sales-orders", salesOrdersRouter);
  app.use("/goods-receipts", goodsReceiptsRouter);
  app.use("/supplier-returns", supplierReturnsRouter);
  app.use("/customer-returns", customerReturnsRouter);
  app.use("/dashboard", dashboardRouter);
  app.use("/reports", reportsRouter);

  app.use(errorHandler);
  return app;
}
