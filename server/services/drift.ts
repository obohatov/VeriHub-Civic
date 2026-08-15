import type { Question, Answer, InsertFinding } from "@shared/schema";
import OpenAI from "openai";
import { storage } from "../storage";
import { computeSeverity } from "./severity";

const driftClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 });

const DRIFT_JUDGE_PROMPT = `You are auditing whether an AI assistant gives CONSISTENT answers across languages about STIB-MIVB services. Below is the official reference value and the model's answers in multiple languages to the SAME question.

Compare ONLY the factual claim (ignore wording/style):
  CONSISTENT   all languages state the same factual value as the reference, OR all decline/hedge similarly
  DIVERGENT    some languages diverge from the reference value OR from each other

Your "reason" must state what the reference requires and which languages match or diverge.

REFERENCE VALUE: {reference}
TOPIC: {topic}

ANSWERS BY LANGUAGE:
{answersFormatted}

Return ONLY JSON: {"consistency":"CONSISTENT|DIVERGENT","perLang":{"<lang>":"<claim or '-'>"},"reason":"<explanation>"}`;

interface DriftResult {
  findings: InsertFinding[];
}

export async function detectDrift(
  auditRunId: string,
  answers: Answer[]
): Promise<DriftResult> {
  const findings: InsertFinding[] = [];
  const questions = await storage.getQuestions();
  const facts = await storage.getFacts();

  // Filter to primary answers (run_index === 0)
  const primaryAnswers = answers.filter((a) => a.runIndex === 0);

  // Group answers by expected fact key
  const answersByFactKey = new Map<
    string,
    { answers: Answer[]; question?: Question }
  >();

  for (const answer of primaryAnswers) {
    const question = questions.find((q) => q.id === answer.questionId);
    if (!question) continue;

    const factKey = question.expectedFactKeys[0];
    if (!factKey) continue;

    const existing = answersByFactKey.get(factKey) || { answers: [] };
    existing.answers.push(answer);
    existing.question = question;
    answersByFactKey.set(factKey, existing);
  }

  // Check each fact key for drift
  const entries = Array.from(answersByFactKey.entries());
  for (const [factKey, data] of entries) {
    // Skip groups with fewer than 2 language answers
    if (data.answers.length < 2 || !data.question) continue;

    // Look up the FR fact as ground-truth reference
    const refFact = facts.find(
      (f) => f.key === factKey && f.lang === "fr"
    );
    if (!refFact) continue;

    // Build array of {lang, answerText}
    const langAnswers = data.answers.map((a) => ({
      lang: a.lang,
      answerText: a.answerText,
    }));

    const driftIssue = await checkForDrift(
      langAnswers,
      refFact.value,
      data.question.topic
    );

    if (driftIssue && driftIssue.consistency === "DIVERGENT") {
      const severity = computeSeverity(7, data.question.riskTag);

      findings.push({
        auditRunId,
        questionId: data.question.id,
        lang: data.question.lang,
        type: "drift",
        severity,
        evidenceJson: {
          topic: data.question.topic,
          factKey,
          reference: refFact.value,
          perLang: driftIssue.perLang,
          reason: driftIssue.reason,
        },
        suggestedFix: `Ensure all languages align with reference value "${refFact.value}": ${driftIssue.reason}`,
      });
    }
  }

  return { findings };
}

interface DriftIssue {
  consistency: "CONSISTENT" | "DIVERGENT";
  perLang: Record<string, string>;
  reason: string;
}

async function checkForDrift(
  answers: Array<{ lang: string; answerText: string }>,
  referenceValue: string,
  topic: string
): Promise<DriftIssue | null> {
  const answersFormatted = answers
    .map((a) => `${a.lang.toUpperCase()}: ${a.answerText}`)
    .join("\n");

  const prompt = DRIFT_JUDGE_PROMPT.replace("{reference}", referenceValue)
    .replace("{topic}", topic)
    .replace("{answersFormatted}", answersFormatted);

  try {
    const c = await driftClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const v = JSON.parse(c.choices[0]?.message?.content || "{}");

    return {
      consistency: v.consistency || "CONSISTENT",
      perLang: v.perLang || {},
      reason: v.reason || "",
    };
  } catch (err) {
    console.error(`[drift-judge] LLM call failed for topic "${topic}":`, err instanceof Error ? err.message : err);
    return null;
  }
}
