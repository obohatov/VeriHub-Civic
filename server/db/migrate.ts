import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const DB_MODE = process.env.DB_MODE || "sqlite";

export async function runMigrations(): Promise<void> {
  if (DB_MODE === "postgres") {
    console.log("[migrate] PostgreSQL mode - using drizzle-kit migrations");
    return;
  }

  console.log("[migrate] Running SQLite migrations...");
  const sqlite = new Database("./data/verihub.db");
  const db = drizzle(sqlite, { schema });

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS facts (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      lang TEXT NOT NULL,
      value TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      last_verified TEXT NOT NULL,
      linked_fact_id TEXT,
      topic TEXT
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS question_sets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      languages TEXT NOT NULL,
      topics TEXT NOT NULL,
      version TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      topic TEXT NOT NULL,
      risk_tag TEXT NOT NULL,
      text TEXT NOT NULL,
      expected_fact_keys TEXT NOT NULL,
      FOREIGN KEY (question_set_id) REFERENCES question_sets(id)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS audit_runs (
      id TEXT PRIMARY KEY,
      question_set_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      baseline_run_id TEXT,
      FOREIGN KEY (question_set_id) REFERENCES question_sets(id)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS answers (
      id TEXT PRIMARY KEY,
      audit_run_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      answer_text TEXT NOT NULL,
      citations TEXT NOT NULL,
      verdict_correctness TEXT,
      verdict_groundedness TEXT,
      verdict_reason TEXT,
      provider TEXT,
      run_index INTEGER DEFAULT 0,
      FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      audit_run_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      lang TEXT NOT NULL,
      type TEXT NOT NULL,
      severity REAL NOT NULL,
      evidence_json TEXT NOT NULL,
      suggested_fix TEXT,
      FOREIGN KEY (audit_run_id) REFERENCES audit_runs(id),
      FOREIGN KEY (question_id) REFERENCES questions(id)
    )
  `);

  console.log("[migrate] SQLite migrations complete");
  sqlite.close();
}

