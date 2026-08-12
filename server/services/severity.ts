import type { RiskTag } from "@shared/schema";

// Single source of truth for finding severity across judge, drift, and scoring.
// Risk weights amplify severity for higher-stakes topics (deadlines, eligibility, fees).
export const riskWeights: Record<RiskTag, number> = {
  deadline: 1.5, eligibility: 1.4, fees: 1.3, contact: 1.2,
  location: 1.1, docs: 1.2, hours: 1.0, general: 0.8,
};

// base: type-dependent starting point on a 0-10 scale (e.g. incorrect=8, ungrounded=5, drift=7)
export function computeSeverity(base: number, riskTag: RiskTag): number {
  const weight = riskTag in riskWeights ? riskWeights[riskTag] : 1.0;
  return Math.min(10, Math.round(base * weight));
}
