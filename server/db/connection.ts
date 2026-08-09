import Database from "better-sqlite3";
import { drizzle as sqliteDrizzle } from "drizzle-orm/better-sqlite3";
import { Pool } from "pg";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const DB_MODE = process.env.DB_MODE || "sqlite";

let db: any;

if (DB_MODE === "postgres") {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error("[db] ERROR: DATABASE_URL is required when DB_MODE=postgres");
		process.exit(1);
	}

	const pool = new Pool({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
	db = pgDrizzle(pool, { schema });
	console.log(`[db] Connected to Postgres via ${databaseUrl}`);
} else {
	const sqlite = new Database("./data/verihub.db");
	sqlite.pragma("journal_mode = WAL");
	db = sqliteDrizzle(sqlite, { schema });
	console.log("[db] Connected to SQLite at ./data/verihub.db");
}

export { db, DB_MODE };
