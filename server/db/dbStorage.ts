import { randomUUID } from "crypto";
import { eq, like, or, desc } from "drizzle-orm";
import { db } from "./connection";
import * as tables from "./schema";
import { loadFactsSeed, loadQuestionSetSeed } from "../loaders/artifactLoader";
import type {
  Fact,
  InsertFact,
  QuestionSet,
  InsertQuestionSet,
  Question,
  InsertQuestion,
  AuditRun,
  InsertAuditRun,
  Answer,
  InsertAnswer,
  Finding,
  InsertFinding,
  DashboardMetrics,
  Comparison,
  FindingType,
  Language,
} from "@shared/schema";
import type { IStorage } from "../storage";

export class DbStorage implements IStorage {
  async getFacts(): Promise<Fact[]> {
    const rows = await db.select().from(tables.factsTable);
    return rows.map(this.rowToFact);
  }

  async getFact(id: string): Promise<Fact | undefined> {
    const rows = await db.select().from(tables.factsTable).where(eq(tables.factsTable.id, id));
    return rows[0] ? this.rowToFact(rows[0]) : undefined;
  }

  async getFactByKey(key: string, lang: Language): Promise<Fact | undefined> {
    const rows = await db.select().from(tables.factsTable)
      .where(eq(tables.factsTable.key, key));
    const filtered = rows.filter((r: any) => r.lang === lang);
    return filtered[0] ? this.rowToFact(filtered[0]) : undefined;
  }

  async searchFacts(query: string): Promise<Fact[]> {
    const rows = await db.select().from(tables.factsTable);
    const lowerQuery = query.toLowerCase();
    return rows
      .filter((r: any) => 
        r.key.toLowerCase().includes(lowerQuery) ||
        r.value.toLowerCase().includes(lowerQuery) ||
        r.topic?.toLowerCase().includes(lowerQuery)
      )
      .map(this.rowToFact);
  }

  async createFact(fact: InsertFact): Promise<Fact> {
    const id = randomUUID();
    await db.insert(tables.factsTable).values({
      id,
      key: fact.key,
      lang: fact.lang,
      value: fact.value,
      sourceRef: fact.sourceRef,
      lastVerified: fact.lastVerified,
      linkedFactId: fact.linkedFactId || null,
      topic: fact.topic || null,
    });
    return { id, ...fact };
  }

  async updateFact(id: string, updates: Partial<InsertFact>): Promise<Fact | undefined> {
    const existing = await this.getFact(id);
    if (!existing) return undefined;
    
    await db.update(tables.factsTable)
      .set({
        key: updates.key ?? existing.key,
        lang: updates.lang ?? existing.lang,
        value: updates.value ?? existing.value,
        sourceRef: updates.sourceRef ?? existing.sourceRef,
        lastVerified: updates.lastVerified ?? existing.lastVerified,
        linkedFactId: updates.linkedFactId ?? existing.linkedFactId,
        topic: updates.topic ?? existing.topic,
      })
      .where(eq(tables.factsTable.id, id));
    
    return { ...existing, ...updates };
  }

  async deleteFact(id: string): Promise<boolean> {
    const result = await db.delete(tables.factsTable).where(eq(tables.factsTable.id, id));
    return true;
  }

  async getQuestionSets(): Promise<QuestionSet[]> {
    const rows = await db.select().from(tables.questionSetsTable);
    return rows.map(this.rowToQuestionSet);
  }

  async getQuestionSet(id: string): Promise<QuestionSet | undefined> {
    const rows = await db.select().from(tables.questionSetsTable).where(eq(tables.questionSetsTable.id, id));
    return rows[0] ? this.rowToQuestionSet(rows[0]) : undefined;
  }

  async createQuestionSet(qs: InsertQuestionSet): Promise<QuestionSet> {
    const id = randomUUID();
    await db.insert(tables.questionSetsTable).values({
      id,
      title: qs.title,
      languages: JSON.stringify(qs.languages),
      topics: JSON.stringify(qs.topics),
      version: qs.version,
    });
    return { id, ...qs };
  }

  async getQuestions(): Promise<Question[]> {
    const rows = await db.select().from(tables.questionsTable);
    return rows.map(this.rowToQuestion);
  }

  async getQuestionsBySet(questionSetId: string): Promise<Question[]> {
    const rows = await db.select().from(tables.questionsTable)
      .where(eq(tables.questionsTable.questionSetId, questionSetId));
    return rows.map(this.rowToQuestion);
  }

  async getQuestion(id: string): Promise<Question | undefined> {
    const rows = await db.select().from(tables.questionsTable).where(eq(tables.questionsTable.id, id));
    return rows[0] ? this.rowToQuestion(rows[0]) : undefined;
  }

  async createQuestion(question: InsertQuestion): Promise<Question> {
    const id = randomUUID();
    await db.insert(tables.questionsTable).values({
      id,
      questionSetId: question.questionSetId,
      lang: question.lang,
      topic: question.topic,
      riskTag: question.riskTag,
      text: question.text,
      expectedFactKeys: JSON.stringify(question.expectedFactKeys),
    });
    return { id, ...question };
  }

  async getAuditRuns(): Promise<AuditRun[]> {
    const rows = await db.select().from(tables.auditRunsTable).orderBy(desc(tables.auditRunsTable.createdAt));
    return rows.map(this.rowToAuditRun);
  }

  async getAuditRun(id: string): Promise<AuditRun | undefined> {
    const rows = await db.select().from(tables.auditRunsTable).where(eq(tables.auditRunsTable.id, id));
    return rows[0] ? this.rowToAuditRun(rows[0]) : undefined;
  }

  async createAuditRun(run: InsertAuditRun): Promise<AuditRun> {
    const id = randomUUID();
    const provider = run.provider || "mock-baseline";
    const newRun: AuditRun = {
      id,
      questionSetId: run.questionSetId,
      provider: provider as any,
      status: "pending",
      createdAt: new Date().toISOString(),
      baselineRunId: run.baselineRunId || null,
    };
    
    await db.insert(tables.auditRunsTable).values({
      id: newRun.id,
      questionSetId: newRun.questionSetId,
      createdAt: newRun.createdAt,
      provider: newRun.provider,
      status: newRun.status,
      baselineRunId: newRun.baselineRunId,
    });
    
    return newRun;
  }

  async updateAuditRun(id: string, updates: Partial<AuditRun>): Promise<AuditRun | undefined> {
    const existing = await this.getAuditRun(id);
    if (!existing) return undefined;
    
    await db.update(tables.auditRunsTable)
      .set({
        status: updates.status ?? existing.status,
        provider: updates.provider ?? existing.provider,
        baselineRunId: updates.baselineRunId ?? existing.baselineRunId,
      })
      .where(eq(tables.auditRunsTable.id, id));
    
    return { ...existing, ...updates };
  }

  async getAnswersByRun(auditRunId: string): Promise<Answer[]> {
    const rows = await db.select().from(tables.answersTable)
      .where(eq(tables.answersTable.auditRunId, auditRunId));
    return rows.map(this.rowToAnswer);
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const id = randomUUID();
    await db.insert(tables.answersTable).values({
      id,
      auditRunId: answer.auditRunId,
      questionId: answer.questionId,
      lang: answer.lang,
      answerText: answer.answerText,
      citations: JSON.stringify(answer.citations),
      verdictCorrectness: answer.verdictCorrectness ?? null,
      verdictGroundedness: answer.verdictGroundedness ?? null,
      verdictReason: answer.verdictReason ?? null,
      provider: answer.provider ?? null,
      runIndex: answer.runIndex ?? 0,
    });
    return { id, ...answer };
  }

  async getFindings(): Promise<Finding[]> {
    const rows = await db.select().from(tables.findingsTable).orderBy(desc(tables.findingsTable.severity));
    return rows.map(this.rowToFinding);
  }

  async getFindingsByRun(auditRunId: string): Promise<Finding[]> {
    const rows = await db.select().from(tables.findingsTable)
      .where(eq(tables.findingsTable.auditRunId, auditRunId))
      .orderBy(desc(tables.findingsTable.severity));
    return rows.map(this.rowToFinding);
  }

  async createFinding(finding: InsertFinding): Promise<Finding> {
    const id = randomUUID();
    await db.insert(tables.findingsTable).values({
      id,
      auditRunId: finding.auditRunId,
      questionId: finding.questionId,
      lang: finding.lang,
      type: finding.type,
      severity: finding.severity,
      evidenceJson: JSON.stringify(finding.evidenceJson),
      suggestedFix: finding.suggestedFix,
    });
    return { id, ...finding };
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const allFindings = await this.getFindings();
    const allRuns = await this.getAuditRuns();

    const findingsByType: Record<FindingType, number> = {
      incorrect: 0,
      outdated: 0,
      ungrounded: 0,
      drift: 0,
      instability: 0,
    };

    const findingsBySeverity = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const findingsByLang: Record<Language, number> = {
      fr: 0,
      nl: 0,
    };

    allFindings.forEach((f) => {
      findingsByType[f.type]++;
      findingsByLang[f.lang]++;
      if (f.severity >= 8) findingsBySeverity.critical++;
      else if (f.severity >= 6) findingsBySeverity.high++;
      else if (f.severity >= 4) findingsBySeverity.medium++;
      else findingsBySeverity.low++;
    });

    const topSeverityFindings = allFindings.slice(0, 5);
    const lastRun = allRuns[0];

    return {
      totalFindings: allFindings.length,
      findingsByType,
      findingsBySeverity,
      findingsByLang,
      topSeverityFindings,
      lastRunDate: lastRun?.createdAt || null,
      totalAuditRuns: allRuns.length,
    };
  }

  async getComparison(baselineId: string, currentId: string): Promise<Comparison | null> {
    const baselineRun = await this.getAuditRun(baselineId);
    const currentRun = await this.getAuditRun(currentId);

    if (!baselineRun || !currentRun) return null;

    const baselineFindings = await this.getFindingsByRun(baselineId);
    const currentFindings = await this.getFindingsByRun(currentId);

    const baselineCounts: Record<FindingType, number> = {
      incorrect: 0,
      outdated: 0,
      ungrounded: 0,
      drift: 0,
      instability: 0,
    };

    const currentCounts: Record<FindingType, number> = {
      incorrect: 0,
      outdated: 0,
      ungrounded: 0,
      drift: 0,
      instability: 0,
    };

    baselineFindings.forEach((f) => baselineCounts[f.type]++);
    currentFindings.forEach((f) => currentCounts[f.type]++);

    const baselineKeys = new Set(
      baselineFindings.map((f) => `${f.questionId}-${f.type}-${f.lang}`)
    );
    const currentKeys = new Set(
      currentFindings.map((f) => `${f.questionId}-${f.type}-${f.lang}`)
    );

    const resolvedFindings = baselineFindings.filter(
      (f) => !currentKeys.has(`${f.questionId}-${f.type}-${f.lang}`)
    );

    const newFindings = currentFindings.filter(
      (f) => !baselineKeys.has(`${f.questionId}-${f.type}-${f.lang}`)
    );

    const improvements = (["incorrect", "outdated", "ungrounded", "drift", "instability"] as FindingType[]).map(
      (type) => ({
        type,
        change: currentCounts[type] - baselineCounts[type],
      })
    );

    return {
      baselineRunId: baselineId,
      currentRunId: currentId,
      baselineDate: baselineRun.createdAt,
      currentDate: currentRun.createdAt,
      baselineCounts,
      currentCounts,
      improvements,
      newFindings,
      resolvedFindings,
    };
  }

  async seedData(): Promise<void> {
    const existingFacts = await db.select().from(tables.factsTable).limit(1);
    const existingQs = await db.select().from(tables.questionSetsTable).limit(1);

    if (existingFacts.length > 0 || existingQs.length > 0) {
      console.log("[seed] Data already exists, skipping seed");
      return;
    }

    console.log("[seed] Seeding database from artifacts...");

    const factsSeed = loadFactsSeed();
    for (const fact of factsSeed) {
      await db.insert(tables.factsTable).values({
        id: fact.id,
        key: fact.key,
        lang: fact.lang,
        value: fact.value,
        sourceRef: fact.source_ref,
        lastVerified: fact.last_verified,
        linkedFactId: fact.linked_fact_id,
        topic: null,
      });
    }
    console.log(`[seed] Loaded ${factsSeed.length} facts`);

    const qsSeed = loadQuestionSetSeed();
    if (qsSeed) {
      const qsId = qsSeed.question_set_id;
      await db.insert(tables.questionSetsTable).values({
        id: qsId,
        title: qsSeed.title,
        languages: JSON.stringify(qsSeed.languages),
        topics: JSON.stringify(qsSeed.topics),
        version: "v2",
      });

      for (const q of qsSeed.questions) {
        await db.insert(tables.questionsTable).values({
          id: q.id,
          questionSetId: qsId,
          lang: q.lang,
          topic: q.topic,
          riskTag: q.risk_tag,
          text: q.text,
          expectedFactKeys: JSON.stringify(q.expected_fact_keys),
        });
      }
      console.log(`[seed] Loaded question set with ${qsSeed.questions.length} questions`);
    }

    console.log("[seed] Database seeding complete");
  }

  private rowToFact(row: tables.FactRow): Fact {
    return {
      id: row.id,
      key: row.key,
      lang: row.lang as Language,
      value: row.value,
      sourceRef: row.sourceRef,
      lastVerified: row.lastVerified,
      linkedFactId: row.linkedFactId,
      topic: row.topic,
    };
  }

  private rowToQuestionSet(row: tables.QuestionSetRow): QuestionSet {
    return {
      id: row.id,
      title: row.title,
      languages: JSON.parse(row.languages),
      topics: JSON.parse(row.topics),
      version: row.version,
    };
  }

  private rowToQuestion(row: tables.QuestionRow): Question {
    return {
      id: row.id,
      questionSetId: row.questionSetId,
      lang: row.lang as Language,
      topic: row.topic,
      riskTag: row.riskTag as any,
      text: row.text,
      expectedFactKeys: JSON.parse(row.expectedFactKeys),
    };
  }

  private rowToAuditRun(row: tables.AuditRunRow): AuditRun {
    return {
      id: row.id,
      questionSetId: row.questionSetId,
      createdAt: row.createdAt,
      provider: row.provider as any,
      status: row.status as any,
      baselineRunId: row.baselineRunId,
    };
  }

  private rowToAnswer(row: tables.AnswerRow): Answer {
    return {
      id: row.id,
      auditRunId: row.auditRunId,
      questionId: row.questionId,
      lang: row.lang as Language,
      answerText: row.answerText,
      citations: JSON.parse(row.citations),
      verdictCorrectness: row.verdictCorrectness as any,
      verdictGroundedness: row.verdictGroundedness as any,
      verdictReason: row.verdictReason,
      provider: row.provider,
      runIndex: row.runIndex,
    };
  }

  private rowToFinding(row: tables.FindingRow): Finding {
    return {
      id: row.id,
      auditRunId: row.auditRunId,
      questionId: row.questionId,
      lang: row.lang as Language,
      type: row.type as FindingType,
      severity: row.severity,
      evidenceJson: JSON.parse(row.evidenceJson),
      suggestedFix: row.suggestedFix,
    };
  }
}
