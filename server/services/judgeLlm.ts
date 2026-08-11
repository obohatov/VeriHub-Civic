import OpenAI from "openai";
import type { Question, Fact, InsertFinding } from "@shared/schema";
import type { LLMResponse } from "./mockLlm";

const JUDGE_MODEL = "gpt-4o";

const JUDGE_PROMPT = `You are auditing what an AI assistant says about STIB-MIVB, the Brussels public transport operator, against the OFFICIAL verified value.

Judge the ANSWER on two axes.

CORRECTNESS — does the answer match the official value?
  CORRECT    states the official value (exact, or within a clearly
             equivalent rounding e.g. "18 months" vs "1.5 years")
  INCORRECT  states a value that differs from the official one
  NOT_STATED gives no concrete value / dodges / stays generic

GROUNDEDNESS — does it refer to an official STIB source?
  GROUNDED     refers to official STIB info or a source
  UNSUPPORTED  makes claims with no source

Your "reason" MUST be one sentence and MUST quote both numbers:
- INCORRECT: name the value the answer gave AND the official value,
  e.g. "Answer says about 5 EUR but the official MOBIB card price is 6 EUR."
- If the answer hedges (e.g. "around", "approximately", "as of 2023"),
  still judge against the official value but mention the hedge,
  e.g. "Answer estimates ~70 EUR (hedged) but the official fine is 107 EUR."
- NOT_STATED: name what was asked and the official value,
  e.g. "Asked for ticket validity (official: 18 months); answer gave no duration."
Always name the official value in the reason.

Return ONLY JSON: {"correctness":"...","groundedness":"...","reason":"..."}

QUESTION (language={lang}):
{question}

OFFICIAL VERIFIED VALUE:
{expected}

ASSISTANT ANSWER:
{answer}`;

interface JudgeVerdict {
  correctness: "CORRECT" | "INCORRECT" | "NOT_STATED";
  groundedness: "GROUNDED" | "UNSUPPORTED";
  reason: string;
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000 });

async function judgeOne(question: Question, answerText: string, expected: string): Promise<JudgeVerdict> {
  const prompt = JUDGE_PROMPT
    .replace("{lang}", question.lang)
    .replace("{question}", question.text)
    .replace("{expected}", expected)
    .replace("{answer}", answerText);

  try {
    const completion = await client.chat.completions.create({
      model: JUDGE_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    return JSON.parse(completion.choices[0]?.message?.content || "{}") as JudgeVerdict;
  } catch (e) {
    return {
      correctness: "NOT_STATED",
      groundedness: "UNSUPPORTED",
      reason: `Judge error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function judgeScoreAnswer(
  question: Question,
  response: LLMResponse,
  facts: Fact[],
  auditRunId: string
): Promise<{ findings: InsertFinding[] }> {
  const findings: InsertFinding[] = [];
  const expectedFacts = facts.filter(
    (f) => question.expectedFactKeys.includes(f.key) && f.lang === question.lang
  );

  if (expectedFacts.length === 0) return { findings };
  const fact = expectedFacts[0];

  const exact = response.answerText.toLowerCase().includes(fact.value.toLowerCase());
  if (exact) return { findings };

  const verdict = await judgeOne(question, response.answerText, fact.value);

  if (verdict.correctness === "INCORRECT") {
    findings.push({
      auditRunId,
      questionId: question.id,
      lang: question.lang,
      type: "incorrect",
      severity: 8,
      evidenceJson: {
        topic: question.topic,
        expectedValue: fact.value,
        factKey: fact.key,
        judgeReason: verdict.reason,
        answerSnippet: response.answerText.slice(0, 200),
      },
      suggestedFix: `Answer contradicts the official value (${fact.value}). ${verdict.reason}`,
    });
  } else if (verdict.correctness === "NOT_STATED" || verdict.groundedness === "UNSUPPORTED") {
    findings.push({
      auditRunId,
      questionId: question.id,
      lang: question.lang,
      type: "ungrounded",
      severity: 5,
      evidenceJson: {
        topic: question.topic,
        factKey: fact.key,
        judgeReason: verdict.reason,
        answerSnippet: response.answerText.slice(0, 200),
      },
      suggestedFix: `Answer is not grounded in the official source. ${verdict.reason}`,
    });
  }

  return { findings };
}
