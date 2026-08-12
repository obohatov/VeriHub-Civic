import type { Question, Answer, InsertFinding, RiskTag } from "@shared/schema";
import OpenAI from "openai";
import { storage } from "../storage";

const driftClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 });

const DRIFT_JUDGE_PROMPT = `You are auditing whether an AI assistant gives CONSISTENT answers across languages. Below are its answers to the SAME factual question about STIB-MIVB, asked in French and Dutch.

Compare ONLY the factual claim (ignore wording/style):
  CONSISTENT   both give the same factual value, OR both decline/hedge similarly
  DIVERGENT    they state different values, OR one gives a confident value while the other hedges/declines

Your "reason" must state what each side claims, e.g. "NL says 70 EUR; FR hedges (October 2023) and gives no amount."

Return ONLY JSON: {"consistency":"CONSISTENT|DIVERGENT","field":"<short label>","frValue":"<what FR claims or '-'>","nlValue":"<what NL claims or '-'>","reason":"..."}

FRENCH ANSWER: {fr}
DUTCH ANSWER: {nl}`;

// Risk weights by tag
const riskWeights: Record<RiskTag, number> = {
  deadline: 1.5,
  eligibility: 1.4,
  fees: 1.3,
  contact: 1.2,
  location: 1.1,
  docs: 1.2,
  hours: 1.0,
  general: 0.8,
};

// Fields to check for drift
const driftFields = [
  "appointment_link",
  "phone",
  "address",
  "deadline_days",
  "hours",
  "url",
  "email",
];

interface DriftResult {
  findings: InsertFinding[];
}

export async function detectDrift(
  auditRunId: string,
  answers: Answer[]
): Promise<DriftResult> {
  const findings: InsertFinding[] = [];
  const questions = await storage.getQuestions();

  // Group answers by expected fact key
  const answersByFactKey = new Map<string, { fr?: Answer; nl?: Answer; question?: Question }>();

  for (const answer of answers) {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const factKey = question.expectedFactKeys[0];
    if (!factKey) continue;

    const existing = answersByFactKey.get(factKey) || {};
    existing[question.lang] = answer;
    existing.question = question;
    answersByFactKey.set(factKey, existing);
  }

  // Check each fact key for drift
  const entries = Array.from(answersByFactKey.entries());
  for (const [factKey, data] of entries) {
    if (!data.fr || !data.nl || !data.question) continue;

    const driftIssue = await checkForDrift(
      data.fr.answerText,
      data.nl.answerText,
      data.question.topic
    );

    if (driftIssue) {
      const baseSeverity = 7;
      const riskTag = data.question.riskTag;
      const weight = riskTag in riskWeights ? riskWeights[riskTag as RiskTag] : 1.0;
      const severity = Math.min(
        10,
        Math.round(baseSeverity * weight)
      );

      findings.push({
        auditRunId,
        questionId: data.question.id,
        lang: data.question.lang,
        type: "drift",
        severity,
        evidenceJson: {
          topic: data.question.topic,
          factKey,
          frValue: driftIssue.frValue,
          nlValue: driftIssue.nlValue,
          field: driftIssue.field,
          reason: driftIssue.reason,
        },
        suggestedFix: `${driftIssue.reason || `Align FR and NL values for ${driftIssue.field}: FR="${driftIssue.frValue}" vs NL="${driftIssue.nlValue}"`}`,
      });
    }
  }

  return { findings };
}

interface DriftIssue {
  field: string;
  frValue: string;
  nlValue: string;
  reason?: string;
}

async function checkForDrift(
  frAnswer: string,
  nlAnswer: string,
  topic: string
): Promise<DriftIssue | null> {
  const prompt = DRIFT_JUDGE_PROMPT.replace("{fr}", frAnswer).replace("{nl}", nlAnswer);

  try {
    const c = await driftClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const v = JSON.parse(c.choices[0]?.message?.content || "{}");
    if (v.consistency !== "DIVERGENT") return null;

    return {
      field: v.field || topic,
      frValue: v.frValue || "-",
      nlValue: v.nlValue || "-",
      reason: v.reason,
    };
  } catch (err) {
    console.error(`[drift-judge] LLM call failed for topic "${topic}":`, err instanceof Error ? err.message : err);
    return null;
  }
}
