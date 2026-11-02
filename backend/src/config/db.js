import { Sequelize } from "sequelize";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

let dbHost = process.env.DB_HOST || "127.0.0.1";
// Force IPv4 loopback to avoid Hostinger ::1 IPv6 access denied
if (dbHost === "localhost") {
  dbHost = "127.0.0.1";
}
const dbPort = Number(process.env.DB_PORT) || 3306;
const dbName = process.env.DB_NAME || "laxmi_enterprises_db";
const dbUser = process.env.DB_USER || "root";
const dbPass = process.env.DB_PASSWORD || "";
const isSSL = process.env.DB_SSL === "true";

export const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: "mysql",
  logging: process.env.DB_LOGGING === "true" ? console.log : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: isSSL
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
});

/**
 * Automatically creates the database if it doesn't exist yet on MySQL
 */
const ensureDatabaseExists = async () => {
  try {
    const connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPass,
      ...(isSSL && { ssl: { rejectUnauthorized: false } }),
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();
  } catch (err) {
    // If connection/credentials error, let authenticate() report it clearly
  }
};

/**
 * Connect to MySQL and automatically synchronize schema changes
 * Whenever you add, rename, or change columns in any model,
 * Sequelize will automatically run ALTER TABLE on the database!
 */
export const connectDB = async () => {
  try {
    console.log(`🔌 Connecting to MySQL (${dbHost}:${dbPort}/${dbName})...`);

    // 1. Ensure database exists in MySQL
    await ensureDatabaseExists();

    // 2. Authenticate connection
    await sequelize.authenticate();
    console.log(`✅ MySQL Connected Successfully: ${dbHost}/${dbName}`);
  } catch (error) {
    console.error(`❌ MySQL Connection Error: ${error.message}`);
    console.warn("\n------------------------------------------------------------");
    console.warn("💡 Troubleshooting your MySQL connection:");
    console.warn("1. Check DB_PASSWORD in backend/.env (your local MySQL root password)");
    console.warn("2. Verify MySQL80 service is running on your machine");
    console.warn("------------------------------------------------------------\n");
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
    throw error;
  }

  // 3. Dynamically import models to ensure all models are registered
  await import("../models/index.js");

  // 4. Migration-First Approach: Execute migrations and verify schema health
  const { runMigrations, verifySchemaHealth } = await import("../migrations/runMigrations.js");
  try {
    await runMigrations();
  } catch (migError) {
    console.error(`❌ Migration Error during startup: ${migError.message}`);
    process.exit(1);
  }

  try {
    await verifySchemaHealth();
  } catch (healthError) {
    console.error(`❌ Schema Health Error during startup: ${healthError.message}`);
    process.exit(1);
  }

  return sequelize;
};
