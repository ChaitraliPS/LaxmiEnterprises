import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../src/config/db.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import { getRevenueSummary, getQuarterlyBreakdown } from "../src/services/revenueService.js";

async function run() {
  await sequelize.authenticate();
  console.log("Connected to MySQL/TiDB database.");

  console.log("\n=================== EMPTY DATABASE: DASHBOARD SUMMARY ===================");
  const dash = await getDashboardSummary({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(dash, null, 2));

  console.log("\n=================== EMPTY DATABASE: REVENUE SUMMARY ===================");
  const rev = await getRevenueSummary({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(rev, null, 2));

  console.log("\n=================== EMPTY DATABASE: QUARTERLY BREAKDOWN =================");
  const qtr = await getQuarterlyBreakdown({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(qtr, null, 2));

  await sequelize.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
