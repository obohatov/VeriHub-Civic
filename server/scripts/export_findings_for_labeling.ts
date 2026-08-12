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

  let targetRunId = runId;
  if (!targetRunId) {
    const allRuns = await storage.getAuditRuns();
    if (allRuns.length === 0) {
      console.error("[export] No audit runs found");
      process.exit(1);
    }
    targetRunId = allRuns[0].id;
    console.log(`[export] No run ID provided; using newest run: ${targetRunId}`);
  }

  // Fetch the audit run to verify it exists
  const run = await storage.getAuditRun(targetRunId);
  if (!run) {
    console.error(`[export] Audit run not found: ${targetRunId}`);
    process.exit(1);
  }

  // Fetch findings for this run
  const findings = await storage.getFindingsByRun(targetRunId);
  if (findings.length === 0) {
    console.warn(`[export] No findings for run ${targetRunId}`);
  }

  // Fetch all questions and answers for quick lookup
  const allQuestions = await storage.getQuestions();
  const allAnswers = await storage.getAnswersByRun(targetRunId);

  // Build a map for quick lookup
  const questionMap = new Map(allQuestions.map((q) => [q.id, q]));
  const answerMap = new Map(
    allAnswers.map((a) => [
      `${a.questionId}`,
      a,
    ])
  );

  // Build CSV rows
  const rows: string[] = [];
  rows.push("finding_id,type,factKey,topic,expected_value,question_text,answer_text,human_verdict,notes");

  for (const finding of findings) {
    const question = questionMap.get(finding.questionId);
    if (!question) {
      console.warn(`[export] Question not found: ${finding.questionId}`);
      continue;
    }

    const answer = answerMap.get(finding.questionId);
    const answerText = answer?.answerText || finding.evidenceJson.answerSnippet || "";

    const factKey = finding.evidenceJson.factKey || "";
    const topic = finding.evidenceJson.topic || question.topic;
    const expectedValue = finding.evidenceJson.expectedValue || "";

    const row = [
      escapeCSV(finding.id),
      escapeCSV(finding.type),
      escapeCSV(factKey),
      escapeCSV(topic),
      escapeCSV(expectedValue),
      escapeCSV(question.text),
      escapeCSV(answerText),
      escapeCSV(""), // human_verdict (empty)
      escapeCSV(""), // notes (empty)
    ].join(",");

    rows.push(row);
  }

  // Write to file
  const outputPath = resolve(process.cwd(), `findings_${targetRunId}.csv`);
  writeFileSync(outputPath, rows.join("\n"), "utf-8");

  console.log(`[export] CSV written to: ${outputPath}`);
  console.log(`[export] Row count (excluding header): ${rows.length - 1}`);
}

main().catch((err) => {
  console.error("[export] Error:", err);
  process.exit(1);
});
