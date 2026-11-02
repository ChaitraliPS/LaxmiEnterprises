import dotenv from "dotenv";
dotenv.config();

import { sequelize } from "../src/config/db.js";
import { getDashboardSummary } from "../src/services/dashboardService.js";
import {
  getRevenueSummary,
  getQuarterlyBreakdown,
  get12MonthCashFlow,
  getCategoryTurnover,
} from "../src/services/revenueService.js";

async function verifyPopulatedLedger() {
  await sequelize.authenticate();
  console.log("Connected to MySQL/TiDB database.");

  console.log("\n=================== POPULATED: DASHBOARD SUMMARY (FY 2026-27) ===================");
  const dash27 = await getDashboardSummary({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(dash27, null, 2));

  console.log("\n=================== POPULATED: REVENUE SUMMARY (FY 2026-27) ===================");
  const rev27 = await getRevenueSummary({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(rev27, null, 2));

  console.log("\n=================== POPULATED: QUARTERLY BREAKDOWN (FY 2026-27) =================");
  const qtr27 = await getQuarterlyBreakdown({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(qtr27, null, 2));

  console.log("\n=================== POPULATED: 12-MONTH CASH FLOW (FY 2026-27) =================");
  const cf27 = await get12MonthCashFlow({ fiscalYear: "2026-27" });
  console.log(JSON.stringify(cf27, null, 2));

  console.log("\n=================== POPULATED: QUARTERLY BREAKDOWN (HISTORICAL FY 2025-26) ========");
  const qtr26 = await getQuarterlyBreakdown({ fiscalYear: "2025-26" });
  console.log(JSON.stringify(qtr26, null, 2));

  await sequelize.close();
}

verifyPopulatedLedger().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});

