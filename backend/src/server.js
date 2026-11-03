import app from "./app.js";
import { connectDB, sequelize } from "./config/db.js";

// Hostinger / CloudLinux Phusion Passenger may supply a numeric port, string port, or Unix domain socket
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // 1. Bind and start HTTP server immediately so Hostinger's reverse proxy does not return 503
  const server = app.listen(PORT, () => {
    console.log(`
=============================================================
  🏢 LAXMI ENTERPRISES ERP - BACKEND API SERVER
  🚀 Status: Running on PORT/Socket: ${PORT}
  📡 API Base: /api/v1
  🩺 Health Check: /health or /api/health
  🛢️ Database: MySQL (Hostinger Ready)
  ⚙️ Environment: ${process.env.NODE_ENV || "development"}
=============================================================
    `);
  });

  // 2. Connect to MySQL without crashing the Node process if database is initializing or pending
  try {
    await connectDB();
  } catch (err) {
    console.error("⚠️ Initial MySQL connection warning (server remains online for health/diagnostics):", err.message);
  }

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      try {
        await sequelize.close();
        console.log("🔒 MySQL connection pool closed.");
        process.exit(0);
      } catch (err) {
        console.error("Error closing MySQL connection:", err);
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer();
