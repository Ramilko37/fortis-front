// Block E — greedy budget fitter ("what to buy first within budget").
// See docs/product/defense-calculator-spec.md §2.

import type {
  BudgetFitResult,
  BudgetPick,
  Criterion,
  DefenseAsset,
  PriorityColor,
  PriorityThresholds,
} from "@/modules/defense-calculator/domain/calculator-types";
import { computeWeightedScore, priorityForScore } from "@/modules/defense-calculator/domain/scoring";

const PRIORITY_RANK: Record<PriorityColor, number> = { green: 0, orange: 1, red: 2 };

export type BudgetFitContext = {
  assets: DefenseAsset[];
  criteria: Criterion[];
  thresholds: PriorityThresholds;
};

/**
 * Rank assets by priority (green → orange → red), then by weighted score descending, and include
 * them greedily until the budget runs out. Skipped (too-expensive) items still appear, marked
 * included: false, so the user sees the full reasoning.
 */
export function fitToBudget(budgetMln: number, context: BudgetFitContext): BudgetFitResult {
  const { assets, criteria, thresholds } = context;

  const ranked = assets
    .map((asset) => {
      const weightedScore = computeWeightedScore(asset.scores, criteria);
      return {
        asset,
        weightedScore,
        priority: priorityForScore(weightedScore, thresholds),
      };
    })
    .sort((a, b) => {
      const rankDelta = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (rankDelta !== 0) return rankDelta;
      return b.weightedScore - a.weightedScore;
    });

  let spentMln = 0;
  const picks: BudgetPick[] = ranked.map(({ asset, weightedScore, priority }) => {
    const fits = spentMln + asset.unitPriceMln <= budgetMln;
    if (fits) spentMln += asset.unitPriceMln;
    return {
      assetId: asset.id,
      assetName: asset.name,
      echelonId: asset.echelonId,
      unitPriceMln: asset.unitPriceMln,
      weightedScore,
      priority,
      cumulativeMln: spentMln,
      included: fits,
    };
  });

  return {
    budgetMln,
    picks,
    spentMln: Math.round(spentMln * 10) / 10,
    remainingMln: Math.round((budgetMln - spentMln) * 10) / 10,
  };
}
