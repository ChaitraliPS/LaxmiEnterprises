import { Router } from "express";
import authRoutes from "./authRoutes.js";
import clientRoutes from "./clientRoutes.js";
import vendorRoutes from "./vendorRoutes.js";
import productRoutes from "./productRoutes.js";
import inventoryRoutes from "./inventoryRoutes.js";
import purchaseRoutes from "./purchaseRoutes.js";
import invoiceRoutes from "./invoiceRoutes.js";
import expoRoutes from "./expoRoutes.js";
import companyRoutes from "./companyRoutes.js";
import dashboardRoutes from "./dashboardRoutes.js";
import revenueRoutes from "./revenueRoutes.js";
import expenseRoutes from "./expenseRoutes.js";
import targetRoutes from "./targetRoutes.js";
import syncRoutes from "./syncRoutes.js";
import adminRoutes from "./adminRoutes.js";

const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/clients", clientRoutes);
apiRouter.use("/vendors", vendorRoutes);
apiRouter.use("/products", productRoutes);
apiRouter.use("/inventory", inventoryRoutes);
apiRouter.use("/purchases", purchaseRoutes);
apiRouter.use("/invoices", invoiceRoutes);
apiRouter.use("/expo", expoRoutes);
apiRouter.use("/company", companyRoutes);
apiRouter.use("/dashboard", dashboardRoutes);
apiRouter.use("/revenue", revenueRoutes);
apiRouter.use("/expenses", expenseRoutes);
apiRouter.use("/targets", targetRoutes);
apiRouter.use("/sync", syncRoutes);
apiRouter.use("/admin", adminRoutes);

export default apiRouter;
