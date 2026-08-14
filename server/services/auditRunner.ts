import { storage } from "../storage";
import { createLlmProvider } from "./mockLlm";
import { scoreAnswer } from "./scoring";
import { judgeScoreAnswer } from "./judgeLlm";
import { detectDrift } from "./drift";
import type { AuditRun, Answer, InsertAnswer, Provider } from "@shared/schema";

export async function runAudit(auditRunId: string): Promise<void> {
  const auditRun = await storage.getAuditRun(auditRunId);
  if (!auditRun) {
    throw new Error(`Audit run not found: ${auditRunId}`);
  }

  await storage.updateAuditRun(auditRunId, { status: "running" });

  try {
    const questions = await storage.getQuestionsBySet(auditRun.questionSetId);
    const facts = await storage.getFacts();

    const llmProvider = createLlmProvider(auditRun.provider as Provider);

    const answers: Answer[] = [];

    for (const question of questions) {
      const response = await llmProvider.getAnswer(question);

      const scoringResult = auditRun.provider === "openai"
        ? await judgeScoreAnswer(question, response, facts, auditRunId)
        : scoreAnswer(question, response, facts, auditRunId);
      
      const v = scoringResult.verdict;
      const answerData: InsertAnswer = {
        auditRunId,
        questionId: question.id,
        lang: question.lang,
        answerText: response.answerText,
        citations: response.citations,
        verdictCorrectness: v?.correctness ?? null,
        verdictGroundedness: v?.groundedness ?? null,
        verdictReason: v?.reason ?? null,
        provider: auditRun.provider,
        runIndex: 0,
      };

      const answer = await storage.createAnswer(answerData);
      answers.push(answer);

      for (const finding of scoringResult.findings) {
        await storage.createFinding(finding);
      }
    }

    const driftResult = await detectDrift(auditRunId, answers);
    
    for (const finding of driftResult.findings) {
      await storage.createFinding(finding);
    }

    await storage.updateAuditRun(auditRunId, { status: "completed" });
  } catch (error) {
    console.error("Audit run failed:", error);
    await storage.updateAuditRun(auditRunId, { status: "failed" });
    throw error;
  }
}
