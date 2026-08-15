import { z } from "zod";

// Language enum
export const languageSchema = z.enum(["fr", "nl"]);
export type Language = z.infer<typeof languageSchema>;

// Risk tags for questions
export const riskTagSchema = z.enum([
  "deadline",
  "eligibility", 
  "location",
  "contact",
  "docs",
  "fees",
  "hours",
  "general"
]);
export type RiskTag = z.infer<typeof riskTagSchema>;

// Finding types
export const findingTypeSchema = z.enum([
  "incorrect",
  "outdated",
  "ungrounded", 
  "drift",
  "instability"
]);
export type FindingType = z.infer<typeof findingTypeSchema>;

// Audit run status
export const auditStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed"
]);
export type AuditStatus = z.infer<typeof auditStatusSchema>;

// LLM Provider
export const providerSchema = z.enum(["mock-baseline", "mock-after", "openai"]);
export type Provider = z.infer<typeof providerSchema>;

// ============== FACTS ==============
export const factSchema = z.object({
  id: z.string(),
  key: z.string(),
  lang: languageSchema,
  value: z.string(),
  sourceRef: z.string(),
  lastVerified: z.string(),
  linkedFactId: z.string().nullable(),
  topic: z.string().nullable(),
});
export type Fact = z.infer<typeof factSchema>;

export const insertFactSchema = factSchema.omit({ id: true });
export type InsertFact = z.infer<typeof insertFactSchema>;

// ============== QUESTION SETS ==============
export const questionSetSchema = z.object({
  id: z.string(),
  title: z.string(),
  languages: z.array(languageSchema),
  topics: z.array(z.string()),
  version: z.string(),
});
export type QuestionSet = z.infer<typeof questionSetSchema>;

export const insertQuestionSetSchema = questionSetSchema.omit({ id: true });
export type InsertQuestionSet = z.infer<typeof insertQuestionSetSchema>;

// ============== QUESTIONS ==============
export const questionSchema = z.object({
  id: z.string(),
  questionSetId: z.string(),
  lang: languageSchema,
  topic: z.string(),
  riskTag: riskTagSchema,
  text: z.string(),
  expectedFactKeys: z.array(z.string()),
});
export type Question = z.infer<typeof questionSchema>;

export const insertQuestionSchema = questionSchema.omit({ id: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;

// ============== AUDIT RUNS ==============
export const auditRunSchema = z.object({
  id: z.string(),
  questionSetId: z.string(),
  createdAt: z.string(),
  provider: providerSchema,
  status: auditStatusSchema,
  baselineRunId: z.string().nullable(),
});
export type AuditRun = z.infer<typeof auditRunSchema>;

export const insertAuditRunSchema = z.object({
  questionSetId: z.string(),
  provider: providerSchema.optional().default("mock-baseline"),
  baselineRunId: z.string().nullable().optional(),
  repetitions: z.number().int().min(1).max(10).optional().default(3),
});
export type InsertAuditRun = z.infer<typeof insertAuditRunSchema>;

// ============== ANSWERS ==============
export const answerSchema = z.object({
  id: z.string(),
  auditRunId: z.string(),
  questionId: z.string(),
  lang: languageSchema,
  answerText: z.string(),
  citations: z.array(z.string()),
  verdictCorrectness: z.enum(["CORRECT","INCORRECT","NOT_STATED","SKIPPED"]).nullable().optional(),
  verdictGroundedness: z.enum(["GROUNDED","UNSUPPORTED"]).nullable().optional(),
  verdictReason: z.string().nullable().optional(),
  provider: z.string().nullable().optional(),
  runIndex: z.number().nullable().optional(),
});
export type Answer = z.infer<typeof answerSchema>;

export const insertAnswerSchema = answerSchema.omit({ id: true });
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

// ============== FINDINGS ==============
export const findingSchema = z.object({
  id: z.string(),
  auditRunId: z.string(),
  questionId: z.string(),
  lang: languageSchema,
  type: findingTypeSchema,
  severity: z.number().min(0).max(10),
  evidenceJson: z.record(z.any()),
  suggestedFix: z.string().nullable(),
});
export type Finding = z.infer<typeof findingSchema>;

export const insertFindingSchema = findingSchema.omit({ id: true });
export type InsertFinding = z.infer<typeof insertFindingSchema>;

// ============== DASHBOARD METRICS ==============
export const dashboardMetricsSchema = z.object({
  totalFindings: z.number(),
  findingsByType: z.record(findingTypeSchema, z.number()),
  findingsBySeverity: z.object({
    critical: z.number(),
    high: z.number(),
    medium: z.number(),
    low: z.number(),
  }),
  findingsByLang: z.record(languageSchema, z.number()),
  topSeverityFindings: z.array(findingSchema),
  lastRunDate: z.string().nullable(),
  totalAuditRuns: z.number(),
});
export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;

// ============== COMPARISON ==============
export const comparisonSchema = z.object({
  baselineRunId: z.string(),
  currentRunId: z.string(),
  baselineDate: z.string(),
  currentDate: z.string(),
  baselineCounts: z.record(findingTypeSchema, z.number()),
  currentCounts: z.record(findingTypeSchema, z.number()),
  improvements: z.array(z.object({
    type: findingTypeSchema,
    change: z.number(),
  })),
  newFindings: z.array(findingSchema),
  resolvedFindings: z.array(findingSchema),
});
export type Comparison = z.infer<typeof comparisonSchema>;

// Keep users for template compatibility
export const users = {
  id: "users_table_placeholder"
};
export type User = { id: string; username: string; password: string };
export type InsertUser = { username: string; password: string };
