import type { Question, Fact, RiskTag, InsertFinding } from "@shared/schema";
import type { LLMResponse } from "./mockLlm";
import type { AnswerVerdict } from "./judgeLlm";
import { getScoringRules } from "../loaders/artifactLoader";

interface ScoringResult {
  verdict: AnswerVerdict | null;
  findings: InsertFinding[];
}

function getRiskWeight(riskTag: string): number {
  const rules = getScoringRules();
  const tagMapping: Record<string, string> = {
    docs: "documents",
    deadline: "deadline",
    eligibility: "eligibility",
    location: "location",
    contact: "contact",
    fees: "fees",
    hours: "hours",
    general: "general",
    documents: "documents",
  };
  
  const mappedTag = tagMapping[riskTag] || riskTag;
  return rules.risk_weights[mappedTag] || 1;
}

function hasCitationMarker(text: string): boolean {
  const rules = getScoringRules();
  const markers = rules.ungrounded?.citation_markers || ["[SRC:", "Source:", "Sources:"];
  return markers.some(marker => text.includes(marker));
}

export function scoreAnswer(
  question: Question,
  response: LLMResponse,
  facts: Fact[],
  auditRunId: string
): ScoringResult {
  const findings: InsertFinding[] = [];
  const rules = getScoringRules();

  const expectedFacts = facts.filter(
    (f) => question.expectedFactKeys.includes(f.key) && f.lang === question.lang
  );

  const weight = getRiskWeight(question.riskTag);

  if (response.citations.length === 0 && !hasCitationMarker(response.answerText)) {
    const hasFactMatch = expectedFacts.some((fact) =>
      response.answerText.toLowerCase().includes(fact.value.toLowerCase().slice(0, 20))
    );

    if (!hasFactMatch) {
      const baseSeverity = 6;
      const severity = Math.min(10, Math.round(baseSeverity * weight / 5));

      findings.push({
        auditRunId,
        questionId: question.id,
        lang: question.lang,
        type: "ungrounded",
        severity,
        evidenceJson: {
          topic: question.topic,
          reason: "No citations provided and answer does not match verified facts",
          answerSnippet: response.answerText.slice(0, 100),
        },
        suggestedFix: "Add proper citations to sources or update answer to match verified facts",
      });
    }
  }

  for (const fact of expectedFacts) {
    const incorrectMatch = detectIncorrectValue(fact, response.answerText);
    
    if (incorrectMatch) {
      const baseSeverity = 8;
      const severity = Math.min(10, Math.round(baseSeverity * weight / 5));

      findings.push({
        auditRunId,
        questionId: question.id,
        lang: question.lang,
        type: "incorrect",
        severity,
        evidenceJson: {
          topic: question.topic,
          expectedValue: fact.value,
          actualValue: incorrectMatch,
          factKey: fact.key,
        },
        suggestedFix: `Update the answer to use the correct value: ${fact.value}`,
      });
    }
  }

  const staleAfterDays = rules.outdated?.stale_after_days || 180;
  
  for (const fact of expectedFacts) {
    const verifiedDate = new Date(fact.lastVerified);
    const daysSinceVerification = Math.floor(
      (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceVerification > staleAfterDays) {
      const factValueNormalized = normalizeValue(fact.value);
      if (!response.answerText.includes(factValueNormalized)) {
        const mightBeOutdated = detectOutdatedPattern(fact, response.answerText);
        
        if (mightBeOutdated) {
          const baseSeverity = 5;
          const severity = Math.min(10, Math.round(baseSeverity * weight / 5));

          findings.push({
            auditRunId,
            questionId: question.id,
            lang: question.lang,
            type: "outdated",
            severity,
            evidenceJson: {
              topic: question.topic,
              lastVerified: fact.lastVerified,
              daysSinceVerification,
              expectedValue: fact.value,
            },
            suggestedFix: `Verify and update the fact: ${fact.key}. Last verified: ${fact.lastVerified}`,
          });
        }
      }
    }
  }

  return { verdict: null, findings };
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/[^\w\s]/g, "").trim();
}

function detectIncorrectValue(fact: Fact, answerText: string): string | null {
  const answerLower = answerText.toLowerCase();
  const factValueLower = fact.value.toLowerCase();

  const factKey = fact.key.toLowerCase();
  
  if (factKey.includes("deadline") || factKey.includes("days") || factKey.includes("fee") || factKey.includes("eur")) {
    const factNumbers = factValueLower.match(/\d+/g);
    const answerNumbers = answerLower.match(/\d+/g);

    if (factNumbers && answerNumbers) {
      const factNum = factNumbers[0];
      const answerNum = answerNumbers.find((n) => n !== factNum);
      
      if (answerNum && factNum !== answerNum) {
        return `${answerNum} (expected: ${factNum})`;
      }
    }
  }

  if (factKey.includes("hours") || factKey.includes("opening")) {
    const timePattern = /(\d{1,2}:\d{2})/g;
    const factTimes: string[] = factValueLower.match(timePattern) || [];
    const answerTimes: string[] = answerLower.match(timePattern) || [];

    if (answerTimes.length > 0 && factTimes.length > 0) {
      const mismatch = answerTimes.find((t: string) => !factTimes.includes(t));
      if (mismatch) {
        return answerTimes.join("-");
      }
    }
  }

  if (factKey.includes("url") || factKey.includes("link")) {
    const urlPattern = /(https?:\/\/[^\s)]+)/g;
    const factUrls = factValueLower.match(urlPattern) || [];
    const answerUrls = answerLower.match(urlPattern) || [];
    
    if (answerUrls.length > 0 && factUrls.length > 0) {
      const mismatch = answerUrls.find((u) => !factUrls.some(fu => u.includes(fu) || fu.includes(u)));
      if (mismatch) {
        return `${mismatch} (expected: ${factUrls[0]})`;
      }
    }
  }

  return null;
}

function detectOutdatedPattern(fact: Fact, answerText: string): boolean {
  const factKey = fact.key.toLowerCase();
  
  if (factKey.includes("hours") || factKey.includes("opening")) {
    const factHasTime = fact.value.match(/\d{1,2}:\d{2}/);
    const answerHasTime = answerText.match(/\d{1,2}:\d{2}/);
    
    if (factHasTime && answerHasTime) {
      return factHasTime[0] !== answerHasTime[0];
    }
  }
  
  return false;
}

export function scoreIncorrect(expected: string, actual: string): boolean {
  return normalizeValue(expected) !== normalizeValue(actual);
}

export function scoreOutdated(lastVerifiedDate: string, staleAfterDays: number = 180): boolean {
  const verifiedDate = new Date(lastVerifiedDate);
  const daysSinceVerification = Math.floor(
    (Date.now() - verifiedDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceVerification > staleAfterDays;
}

export function scoreUngrounded(answerText: string, citations: string[]): boolean {
  if (citations.length > 0) return false;
  return !hasCitationMarker(answerText);
}
