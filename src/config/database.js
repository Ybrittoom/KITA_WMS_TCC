import { Pool } from "pg";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config();

const dbHost = process.env.DB_HOST;
const isLocalDatabase = dbHost === "localhost" || dbHost === "127.0.0.1";
const useSsl = process.env.DB_SSL === "true" ||
  (!isLocalDatabase && process.env.DB_SSL !== "false");
const sslCa = process.env.DB_SSL_CA
  ? readFileSync(process.env.DB_SSL_CA, "utf8")
  : undefined;

const pool = new Pool({
  host: dbHost,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: useSsl
    ? { rejectUnauthorized: true, ...(sslCa ? { ca: sslCa } : {}) }
    : false,
  max: 5,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (error) => {
	console.error("Erro em conexão ociosa com PostgreSQL:", error.message);
});

export default pool;

