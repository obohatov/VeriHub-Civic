import { writeFileSync } from "fs";
import { resolve } from "path";
import { storage } from "../storage";

function escapeCSV(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main() {
  const runId = process.argv[2];

  if (!runId) {
    console.error("[export] Usage: tsx export_answers_for_calibration.ts <run_id>");
    process.exit(1);
  }

  // Fetch the audit run to verify it exists
  const run = await storage.getAuditRun(runId);
  if (!run) {
    console.error(`[export] Audit run not found: ${runId}`);
    process.exit(1);
  }

  // Fetch all answers for this run
  const answers = await storage.getAnswersByRun(runId);
  if (answers.length === 0) {
    console.warn(`[export] No answers for run ${runId}`);
    process.exit(0);
  }

  // Fetch all questions and facts for lookup
  const allQuestions = await storage.getQuestions();
  const allFacts = await storage.getFacts();

  // Build maps for quick lookup
  const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
  const factMap = new Map(allFacts.map((f) => [f.key, f]));

  // Build blind labeling CSV rows (without judge verdict)
  const blindRows: string[] = [];
  blindRows.push("answer_id,question_text,expected_value,answer_text,human_verdict,notes");

  // Build judge key CSV rows (separate file with verdicts)
  const keyRows: string[] = [];
  keyRows.push("answer_id,_judge_correctness");

  for (const answer of answers) {
    const question = questionMap.get(answer.questionId);
    if (!question) {
      console.warn(`[export] Question not found: ${answer.questionId}`);
      continue;
    }

    // Get the expected fact value from the first expected fact key
    let expectedValue = "";
    if (question.expectedFactKeys && question.expectedFactKeys.length > 0) {
      const factKey = question.expectedFactKeys[0];
      const fact = allFacts.find((f) => f.key === factKey && f.lang === answer.lang);
      if (fact) {
        expectedValue = fact.value;
      }
    }

    // Blind CSV row (human labeling, no verdict)
    const blindRow = [
      escapeCSV(answer.id),
      escapeCSV(question.text),
      escapeCSV(expectedValue),
      escapeCSV(answer.answerText),
      escapeCSV(""), // human_verdict (empty for human to fill)
      escapeCSV(""), // notes (empty for human to fill)
    ].join(",");

    blindRows.push(blindRow);

    // Judge key row (for later scoring)
    const keyRow = [
      escapeCSV(answer.id),
      escapeCSV(answer.verdictCorrectness || ""),
    ].join(",");

    keyRows.push(keyRow);
  }

  // Write blind labeling CSV
  const blindOutputPath = resolve(process.cwd(), `findings_${runId}_to_label.csv`);
  writeFileSync(blindOutputPath, blindRows.join("\n"), "utf-8");

  // Write judge key CSV
  const keyOutputPath = resolve(process.cwd(), `answers_${runId}_judge_key.csv`);
  writeFileSync(keyOutputPath, keyRows.join("\n"), "utf-8");

  console.log(`[export] Blind labeling CSV: ${blindOutputPath}`);
  console.log(`[export] Judge key CSV: ${keyOutputPath}`);
  console.log(`[export] Row count (excluding header): ${blindRows.length - 1}`);
}

main().catch((err) => {
  console.error("[export] Error:", err);
  process.exit(1);
});
