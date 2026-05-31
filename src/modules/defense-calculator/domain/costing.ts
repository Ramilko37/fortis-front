// Block C (configuration estimate) + Block D (echelon coverage).
// See docs/product/defense-calculator-spec.md §2.

import type {
  Configuration,
  ConfigurationEstimate,
  Criterion,
  DefenseAsset,
  Echelon,
  EchelonEstimate,
  EstimateLine,
  PriorityThresholds,
} from "@/modules/defense-calculator/domain/calculator-types";
import { computeWeightedScore, priorityForScore } from "@/modules/defense-calculator/domain/scoring";

export type CostingContext = {
  assets: DefenseAsset[];
  echelons: Echelon[];
  criteria: Criterion[];
  thresholds: PriorityThresholds;
  /**
   * Optional per-line lump-sum override of the line total (in млн руб). Used for the bundled
   * ИТЗ/АТЗ echelons where the PDF gives a per-configuration lump sum rather than unit×qty.
   * Keyed by assetId.
   */
  lineTotalOverridesMln?: Record<string, number>;
};

function roundMln(value: number): number {
  // Keep one decimal — prices like 7.9 must not drift.
  return Math.round(value * 10) / 10;
}

/**
 * Block C + D — cost a configuration and compute per-echelon coverage.
 */
export function estimateConfiguration(
  configuration: Configuration,
  context: CostingContext,
): ConfigurationEstimate {
  const { assets, echelons, criteria, thresholds, lineTotalOverridesMln } = context;
  const assetsById = new Map(assets.map((asset) => [asset.id, asset]));

  // Build costed lines.
  const lines: EstimateLine[] = configuration.lines.flatMap((line) => {
    const asset = assetsById.get(line.assetId);
    if (!asset) return [];
    const override = lineTotalOverridesMln?.[line.assetId];
    const lineTotalMln = override !== undefined ? override : roundMln(asset.unitPriceMln * line.quantity);
    const weightedScore = computeWeightedScore(asset.scores, criteria);
    return [
      {
        assetId: asset.id,
        assetName: asset.name,
        echelonId: asset.echelonId,
        quantity: line.quantity,
        unitPriceMln: asset.unitPriceMln,
        lineTotalMln,
        priority: priorityForScore(weightedScore, thresholds),
      },
    ];
  });

  // Roll up per echelon (preserving the canonical echelon order).
  const echelonEstimates: EchelonEstimate[] = echelons.map((echelon) => {
    const echelonLines = lines.filter((line) => line.echelonId === echelon.id);
    const echelonTotalMln = roundMln(echelonLines.reduce((acc, line) => acc + line.lineTotalMln, 0));

    // Block D — coverage = mean weighted score of the assets placed in this echelon (0–1).
    const scoresOfPlaced = echelonLines.map((line) => {
      const asset = assetsById.get(line.assetId);
      return asset ? computeWeightedScore(asset.scores, criteria) : 0;
    });
    const coveragePct =
      scoresOfPlaced.length > 0
        ? scoresOfPlaced.reduce((acc, value) => acc + value, 0) / scoresOfPlaced.length / 100
        : 0;

    return {
      echelonId: echelon.id,
      echelonName: echelon.name,
      lines: echelonLines,
      echelonTotalMln,
      coveragePct,
      isEmpty: echelonLines.length === 0,
    };
  });

  const totalMln = roundMln(echelonEstimates.reduce((acc, echelon) => acc + echelon.echelonTotalMln, 0));

  return {
    configurationId: configuration.id,
    configurationName: configuration.name,
    echelons: echelonEstimates,
    totalMln,
  };
}
