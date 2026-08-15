import OpenAI from "openai";
import type { Answer, InsertFinding, Question } from "@shared/schema";
import { storage } from "../storage";
import { computeSeverity } from "./severity";

const instabilityClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 30_000,
});

interface InstabilityResult {
  findings: InsertFinding[];
}

export async function detectInstability(
  auditRunId: string,
  answers: Answer[]
): Promise<InstabilityResult> {
  const findings: InsertFinding[] = [];
  const questions = await storage.getQuestions();
  const questionMap = new Map<string, Question>();

  for (const question of questions) {
    questionMap.set(question.id, question);
  }

  const answersByQuestion = new Map<string, Answer[]>();
  for (const answer of answers) {
    const list = answersByQuestion.get(answer.questionId) ?? [];
    list.push(answer);
    answersByQuestion.set(answer.questionId, list);
  }

  const entries = Array.from(answersByQuestion.entries());
  for (const [questionId, questionAnswers] of entries) {
    if (questionAnswers.length < 2) continue;

    const question = questionMap.get(questionId);
    if (!question) continue;

    const verdicts: Array<NonNullable<Answer["verdictCorrectness"]>> = questionAnswers
      .map((answer: Answer) => answer.verdictCorrectness)
      .filter((value): value is NonNullable<Answer["verdictCorrectness"]> => value !== null && value !== undefined);

    if (verdicts.length === 0) continue;

    const allSame = verdicts.every((value: NonNullable<Answer["verdictCorrectness"]>) => value === verdicts[0]);

    if (!allSame) {
      const reason = `${questionAnswers.length} repetitions disagreed: ${verdicts.join(", ")}`;
      findings.push({
        auditRunId,
        questionId: question.id,
        lang: question.lang,
        type: "instability",
        severity: computeSeverity(6, question.riskTag),
        evidenceJson: {
          topic: question.topic,
          factKey: question.expectedFactKeys[0] ?? null,
          verdicts,
          answerSnippets: questionAnswers.map((answer: Answer) => (answer.answerText || "").slice(0, 150)),
        },
        suggestedFix: reason,
      });
      continue;
    }

    if (verdicts[0] === "CORRECT") {
      const judge = await judgeIfStable(questionAnswers, question);
      if (judge && !judge.stable) {
        findings.push({
          auditRunId,
          questionId: question.id,
          lang: question.lang,
          type: "instability",
          severity: computeSeverity(6, question.riskTag),
          evidenceJson: {
            topic: question.topic,
            factKey: question.expectedFactKeys[0] ?? null,
            verdicts,
            answerSnippets: questionAnswers.map((answer: Answer) => (answer.answerText || "").slice(0, 150)),
          },
          suggestedFix: judge.reason,
        });
      }
    }
  }

  return { findings };
}

interface StabilityJudgement {
  stable: boolean;
  reason: string;
}

async function judgeIfStable(
  answers: Answer[],
  question: Question
): Promise<StabilityJudgement | null> {
  const prompt = `You are auditing whether repeated answers to the same question are actually the same factual claim or not.

Question: ${question.text}

Repeated answers (same question, different runs):
${answers
  .map((answer, index) => `REPETITION ${index + 1}: ${answer.answerText}`)
  .join("\n---\n")}

Decide whether they state the SAME value or DIFFERENT values.
Return ONLY JSON: {"stable":true|false,"reason":"..."}

Examples:
- Same factual value: {"stable":true,"reason":"All repetitions state the same amount: 70 EUR."}
- Different values: {"stable":false,"reason":"Repetition 1 says 70 EUR; repetition 2 says 90 EUR."}`;

  try {
    const completion = await instabilityClient.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    if (typeof parsed.stable !== "boolean") {
      return null;
    }

    return {
      stable: Boolean(parsed.stable),
      reason: String(parsed.reason || "Repeated answers differ in stated value."),
    };
  } catch (error) {
    console.error("[instability-judge]", error instanceof Error ? error.message : error);
    return null;
  }
}
