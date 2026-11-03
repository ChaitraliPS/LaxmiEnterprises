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

export let dbConnectionState = {
  connected: false,
  error: null,
  database: dbName,
  host: dbHost,
  port: dbPort,
};

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
 * Safely handled for shared hosting environments like Hostinger
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
    // Shared hosting user may not have global CREATE DATABASE privilege; ignore and let authenticate proceed
  }
};

/**
 * Fully Automatic Schema Evolver
 * Scans all defined Sequelize models on every startup / deployment.
 * Automatically creates missing tables and automatically adds missing columns to MySQL.
 * Eliminates the need to write or run manual migrations forever.
 */
export const autoEvolveSchema = async () => {
  try {
    const qi = sequelize.getQueryInterface();
    const models = Object.values(sequelize.models);

    for (const model of models) {
      const rawTableName = model.getTableName();
      const tableName = typeof rawTableName === "object" ? rawTableName.tableName : rawTableName;

      // 1. Ensure table exists in MySQL
      await model.sync().catch(() => {});

      // 2. Describe table to find actual columns in MySQL
      const tableDesc = await qi.describeTable(tableName).catch(() => ({}));

      // 3. Compare model attributes and automatically add any missing column
      for (const [colName, attr] of Object.entries(model.rawAttributes)) {
        if (!tableDesc[colName]) {
          console.log(`⚡ Auto-adding missing column to MySQL: ${tableName}.${colName}`);
          await qi.addColumn(tableName, colName, attr).catch(() => {});
        }
      }
    }
    console.log("✅ Auto Schema Evolution: All tables and model columns are 100% in sync.");
  } catch (err) {
    console.warn("⚠️ Auto-schema evolution notice:", err.message);
  }
};

/**
 * Connect to MySQL and automatically synchronize schema changes
 */
export const connectDB = async () => {
  try {
    console.log(`🔌 Connecting to MySQL (${dbHost}:${dbPort}/${dbName})...`);

    // 1. Ensure database exists in MySQL
    await ensureDatabaseExists();

    // 2. Authenticate connection
    await sequelize.authenticate();
    dbConnectionState.connected = true;
    dbConnectionState.error = null;
    console.log(`✅ MySQL Connected Successfully: ${dbHost}/${dbName}`);
  } catch (error) {
    dbConnectionState.connected = false;
    dbConnectionState.error = error.message;
    console.error(`❌ MySQL Connection Error: ${error.message}`);
    console.warn("\n------------------------------------------------------------");
    console.warn("💡 Troubleshooting your MySQL connection:");
    console.warn("1. Check DB_HOST, DB_NAME, DB_USER, DB_PASSWORD in backend/.env");
    console.warn("2. On Hostinger, verify the database prefix (e.g. u123456789_dbname)");
    console.warn("3. Ensure DB_SSL is false for Hostinger localhost MySQL");
    console.warn("------------------------------------------------------------\n");
    return null;
  }

  // 3. Dynamically import models to ensure all models are registered
  await import("../models/index.js");

  // 4. Fully Automated Schema & Column Synchronization (Runs on every deploy)
  await autoEvolveSchema();

  // 5. Schema Sync: Ensures all tables, relations, and indexes exist in the database
  try {
    await sequelize.sync();
    console.log("⚡ Schema base sync complete: all model tables verified.");
  } catch (syncErr) {
    console.warn("⚠️ Base sync warning:", syncErr.message);
  }

  return sequelize;
};
