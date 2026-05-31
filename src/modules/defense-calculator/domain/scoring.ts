// Block A (weighted score) + Block B (priority colour).
// See docs/product/defense-calculator-spec.md §2.

import type {
  AssetScore,
  Criterion,
  CriterionScores,
  DefenseAsset,
  PriorityColor,
  PriorityThresholds,
} from "@/modules/defense-calculator/domain/calculator-types";

const MAX_RAW_SCORE = 5;

/**
 * Block A — weighted score on a 0–100 scale, reproducing Excel column L.
 * score = Σ(weight_i × rawScore_i) / maxRaw, with Σ weight = 100.
 */
export function computeWeightedScore(scores: CriterionScores, criteria: Criterion[]): number {
  const weighted = criteria.reduce((acc, criterion) => acc + criterion.weight * scores[criterion.id], 0);
  return weighted / MAX_RAW_SCORE;
}

/** Block B — map a 0–100 weighted score to a priority colour. */
export function priorityForScore(score: number, thresholds: PriorityThresholds): PriorityColor {
  if (score >= thresholds.green) return "green";
  if (score >= thresholds.orange) return "orange";
  return "red";
}

/** Convenience: score + priority for one asset. */
export function scoreAsset(
  asset: DefenseAsset,
  criteria: Criterion[],
  thresholds: PriorityThresholds,
): AssetScore {
  const weightedScore = computeWeightedScore(asset.scores, criteria);
  return {
    assetId: asset.id,
    weightedScore,
    priority: priorityForScore(weightedScore, thresholds),
  };
}

/** True if the criteria weights form a valid set (sum to 100). */
export function weightsAreValid(criteria: Criterion[]): boolean {
  const sum = criteria.reduce((acc, criterion) => acc + criterion.weight, 0);
  return Math.abs(sum - 100) < 1e-9;
}
