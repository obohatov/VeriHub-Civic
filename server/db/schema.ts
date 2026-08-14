import { pgTable, text, integer, real } from "drizzle-orm/pg-core";

export const factsTable = pgTable("facts", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  lang: text("lang").notNull(),
  value: text("value").notNull(),
  sourceRef: text("source_ref").notNull(),
  lastVerified: text("last_verified").notNull(),
  linkedFactId: text("linked_fact_id"),
  topic: text("topic"),
});

export const questionSetsTable = pgTable("question_sets", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  languages: text("languages").notNull(),
  topics: text("topics").notNull(),
  version: text("version").notNull(),
});

export const questionsTable = pgTable("questions", {
  id: text("id").primaryKey(),
  questionSetId: text("question_set_id").notNull().references(() => questionSetsTable.id),
  lang: text("lang").notNull(),
  topic: text("topic").notNull(),
  riskTag: text("risk_tag").notNull(),
  text: text("text").notNull(),
  expectedFactKeys: text("expected_fact_keys").notNull(),
});

export const auditRunsTable = pgTable("audit_runs", {
  id: text("id").primaryKey(),
  questionSetId: text("question_set_id").notNull().references(() => questionSetsTable.id),
  createdAt: text("created_at").notNull(),
  provider: text("provider").notNull(),
  status: text("status").notNull(),
  baselineRunId: text("baseline_run_id"),
});

export const answersTable = pgTable("answers", {
  id: text("id").primaryKey(),
  auditRunId: text("audit_run_id").notNull().references(() => auditRunsTable.id),
  questionId: text("question_id").notNull().references(() => questionsTable.id),
  lang: text("lang").notNull(),
  answerText: text("answer_text").notNull(),
  citations: text("citations").notNull(),
  verdictCorrectness: text("verdict_correctness"),
  verdictGroundedness: text("verdict_groundedness"),
  verdictReason: text("verdict_reason"),
  provider: text("provider"),
  runIndex: integer("run_index").default(0),
});

export const findingsTable = pgTable("findings", {
  id: text("id").primaryKey(),
  auditRunId: text("audit_run_id").notNull().references(() => auditRunsTable.id),
  questionId: text("question_id").notNull().references(() => questionsTable.id),
  lang: text("lang").notNull(),
  type: text("type").notNull(),
  severity: real("severity").notNull(),
  evidenceJson: text("evidence_json").notNull(),
  suggestedFix: text("suggested_fix"),
});

export type FactRow = typeof factsTable.$inferSelect;
export type QuestionSetRow = typeof questionSetsTable.$inferSelect;
export type QuestionRow = typeof questionsTable.$inferSelect;
export type AuditRunRow = typeof auditRunsTable.$inferSelect;
export type AnswerRow = typeof answersTable.$inferSelect;
export type FindingRow = typeof findingsTable.$inferSelect;
