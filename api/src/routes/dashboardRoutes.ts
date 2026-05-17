import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { transactionsModel } from "../models/transactionsModel.js";
import { mastersModel } from "../models/mastersModel.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.use(requirePermission("dashboard.read"));

dashboardRouter.get("/summary", async (req, res, next) => {
  try {
    const q = z
      .object({
        range: z.enum(["monthly", "quarterly", "yearly"]).optional(),
        profit_range_months: z.enum(["1", "3", "12"]).optional(),
      })
      .parse(req.query);

    const months =
      q.profit_range_months === "12" ? 12 : q.profit_range_months === "3" ? 3 : 1;
    const empRange = q.range ?? "monthly";

    const [
      recent_transactions,
      sales_by_day,
      top_selling_products,
      low_stock_alerts,
      profit_overview_row,
      employee_performance,
      repairs_by_technician,
      daily_summary,
      monthly_summary,
      sales_by_user,
    ] = await Promise.all([
      transactionsModel.dashboard.recentTransactions(20),
      transactionsModel.dashboard.salesTotalsByDays(30),
      transactionsModel.dashboard.topSellingItems(8),
      mastersModel.stock.lowStock(5),
      transactionsModel.dashboard.profitRough(months),
      transactionsModel.dashboard.employeeSales(empRange),
      transactionsModel.dashboard.repairsHandled(),
      transactionsModel.dashboard.dailySummary(),
      transactionsModel.dashboard.monthlySummary(),
      transactionsModel.dashboard.invoicesByCreator(),
    ]);

    const revenue = Number(profit_overview_row.revenue ?? 0);
    const cogs = Number(profit_overview_row.cogs ?? 0);

    res.json({
      recent_transactions,
      sales_by_day,
      top_selling_products,
      low_stock_alerts,
      profit_overview: {
        revenue,
        cogs,
        gross_profit: revenue - cogs,
        months_covered: months,
      },
      employee_performance,
      repairs_by_technician,
      daily_summary,
      monthly_summary,
      sales_by_user,
    });
  } catch (e) {
    next(e);
  }
});

dashboardRouter.get("/recent-transactions", async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    res.json(await transactionsModel.dashboard.recentTransactions(limit));
  } catch (e) {
    next(e);
  }
});
