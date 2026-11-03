import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import multer from "multer";

import apiRouter from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./middlewares/errorMiddleware.js";
import { ApiResponse } from "./utils/apiResponse.js";
import { dbConnectionState } from "./config/db.js";

dotenv.config();

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max limit
});

const app = express();

// Trust reverse proxy headers from Hostinger / Cloud load balancers
app.set("trust proxy", 1);

// Security HTTP headers
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

// CORS Configuration
const rawAllowedOrigins = (process.env.CORS_ORIGIN || "*")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (rawAllowedOrigins.includes("*") || rawAllowedOrigins.includes(origin)) return true;
  // Localhost & loopbacks
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  // Production Shivcoretech domain & subdomains (e.g. laxmienterprises.shivcoretech.com)
  if (/^https:\/\/[a-zA-Z0-9_\-.]*\.?shivcoretech\.com$/.test(origin)) return true;
  // Hostinger site previews (*.hostingersite.com)
  if (/^https:\/\/[a-zA-Z0-9_\-.]*\.?hostingersite\.com$/.test(origin)) return true;
  // Vercel deployment preview domains
  if (/^https:\/\/[a-zA-Z0-9_\-.]+\.vercel\.app$/.test(origin)) return true;
  return false;
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);
app.options("*", cors());

// Logging
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
}

// Request parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve uploaded static files
app.use("/uploads", express.static(uploadDir));

// Root health check endpoints
const healthCheckHandler = (req, res) => {
  const isDbConnected = dbConnectionState.connected;
  const status = isDbConnected ? 200 : 503;
  return res.status(status).json({
    success: isDbConnected,
    statusCode: status,
    message: isDbConnected
      ? "Laxmi Enterprises ERP Backend Service is running smoothly"
      : `Laxmi Enterprises ERP Backend is online, but MySQL connection is degraded: ${dbConnectionState.error || "Connecting..."}`,
    data: {
      status: "online",
      database: {
        status: isDbConnected ? "connected" : "disconnected",
        name: dbConnectionState.database,
        host: dbConnectionState.host,
        port: dbConnectionState.port,
        error: dbConnectionState.error,
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    },
  });
};
app.get("/", healthCheckHandler);
app.get("/api/health", healthCheckHandler);
app.get("/health", healthCheckHandler);

// Generic File Upload Endpoint
const fileUploadHandler = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file was uploaded" });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return ApiResponse.success(
    res,
    {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      url: fileUrl,
    },
    "File uploaded successfully"
  );
};

app.post("/api/v1/upload", upload.single("file"), fileUploadHandler);
app.post("/api/upload", upload.single("file"), fileUploadHandler);
app.post("/upload", upload.single("file"), fileUploadHandler);

// Mount API Router across all common path variations (/api/v1, /api, and /)
app.use("/api/v1", apiRouter);
app.use("/api", apiRouter);
app.use("/", apiRouter);

// 404 & Error Handling Middlewares
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
