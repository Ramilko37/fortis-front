import type {
  Configuration,
  DefenseAsset,
  DefenseCatalogResponse,
  DefenseLayer,
  DefenseLayerId,
  Facility,
  HexCell,
  KpiResult,
  Recommendation,
} from "@/shared/types/drone-defense";
import { getLayerDistanceFit, measureGeoDistanceM } from "@/modules/drone-defense/infra/mock-defense-data";

type EvalContext = {
  catalog: DefenseCatalogResponse;
  assetsById: Map<string, DefenseAsset>;
  cells: HexCell[];
  layers: DefenseLayer[];
  facilities: Facility[];
};

const SUITABILITY_WEIGHTS = {
  effEnv: 0.35,
  availability: 0.2,
  governance: 0.2,
  deploySpeed: 0.15,
  costScore: 0.1,
} as const;

function computeSuitability(asset: DefenseAsset): number {
  return (
    SUITABILITY_WEIGHTS.effEnv * asset.suitability.effEnv +
    SUITABILITY_WEIGHTS.availability * asset.suitability.availability +
    SUITABILITY_WEIGHTS.governance * asset.suitability.governance +
    SUITABILITY_WEIGHTS.deploySpeed * asset.suitability.deploySpeed +
    SUITABILITY_WEIGHTS.costScore * asset.suitability.costScore
  );
}

function computePlacementEffect(
  asset: DefenseAsset,
  layerId: DefenseLayerId,
  threatType: keyof DefenseAsset["threatCoefficients"],
  readiness: number,
  environmentModifier: number,
  matrixWeight: number,
  distanceFit: number,
  selectedLayerId: DefenseLayerId | undefined,
  placementBoost: number,
): number {
  if (selectedLayerId && selectedLayerId !== layerId) return 0;
  if (!selectedLayerId && !asset.layerIds.includes(layerId)) return 0;
  const suitability = computeSuitability(asset);
  const threatMatch = asset.threatCoefficients[threatType];
  return Math.max(0, Math.min(0.98, suitability * threatMatch * readiness * environmentModifier * matrixWeight * distanceFit * placementBoost));
}

function describeRecommendation(asset: DefenseAsset, layers: DefenseLayer[]): string {
  const layerList = asset.layerIds.map((layerId) => {
    const layer = layers.find((item) => item.id === layerId);
    return layer ? `${layer.shortName} (${layer.distanceBandM.label})` : layerId;
  });
  const joined = layerList.join(", ");

  if (asset.scope === "regional") {
    return `Закрывает территориальный gap по ${joined} для угроз в GIS-коридорах`;
  }

  return `Усиливает локальный gap по ${joined} возле критических узлов площадки`;
}

export function evaluateConfiguration(
  configuration: Configuration,
  context: EvalContext,
): KpiResult {
  const cells = context.cells.filter((cell) => cell.facilityId === configuration.facilityId);
  const { layers, catalog } = context;
  const facility = context.facilities.find((item) => item.id === configuration.facilityId);
  const layerCoverageAccumulator = new Map<DefenseLayerId, number>();

  let baselineRisk = 0;
  let residualRisk = 0;
  let capexRub = 0;
  let opexRubYear = 0;

  configuration.placements.forEach((placement) => {
    const asset = context.assetsById.get(placement.assetId);
    if (!asset) return;
    capexRub += asset.cost.capexRub * placement.qty;
    opexRubYear += asset.cost.opexRubYear * placement.qty;
  });

  for (const cell of cells) {
    for (const threat of catalog.threatTypes) {
      const base = cell.baseRisk[threat.id] * cell.priorityWeight * threat.weight;
      baselineRisk += base;

      let residualFactor = 1;
      const cellDistanceM = facility ? measureGeoDistanceM(facility.center, cell.center) : 0;

      for (const layer of layers) {
        const distanceFit = getLayerDistanceFit(layer, cellDistanceM);
        const effects = configuration.placements.map((placement) => {
          const asset = context.assetsById.get(placement.assetId);
          if (!asset) return 0;
          const matrixWeight = catalog.matrix[threat.id][layer.id];
          return computePlacementEffect(
            asset,
            layer.id,
            threat.id,
            placement.readiness,
            placement.environmentModifier,
            matrixWeight,
            distanceFit,
            placement.layerId,
            placement.layerGapBoost * placement.criticalityBoost * placement.feasibility,
          );
        });

        const layerEffect = 1 - effects.reduce((acc, value) => acc * (1 - value), 1);
        residualFactor *= 1 - layerEffect;
        layerCoverageAccumulator.set(layer.id, (layerCoverageAccumulator.get(layer.id) ?? 0) + layerEffect);
      }

      residualRisk += base * residualFactor;
    }
  }

  const tco3yRub = capexRub + 3 * opexRubYear;
  const riskReduction = Math.max(0, baselineRisk - residualRisk);
  const riskReductionPct = baselineRisk > 0 ? riskReduction / baselineRisk : 0;
  const costPerRiskPointRub = riskReduction > 0 ? tco3yRub / riskReduction : tco3yRub;
  const valuePerRuble = tco3yRub > 0 ? riskReduction / tco3yRub : 0;

  const layerCoverage = layers.map((layer) => {
    const effectSum = layerCoverageAccumulator.get(layer.id) ?? 0;
    const denominator = Math.max(1, cells.length * catalog.threatTypes.length);
    return {
      layerId: layer.id,
      coveredPct: Math.max(0, Math.min(1, effectSum / denominator)),
      distanceBandM: layer.distanceBandM,
    };
  });

  const layerCoverageAvg =
    layerCoverage.reduce((acc, item) => acc + item.coveredPct, 0) / Math.max(1, layerCoverage.length);

  const protectedAssetsPct = Math.min(1, 0.25 + riskReductionPct * 0.85);
  const perimeterCoveredPct = Math.min(1, layerCoverageAvg);

  return {
    facilityId: configuration.facilityId,
    scenarioId: configuration.scenarioId,
    capexRub,
    opexRubYear,
    tco3yRub,
    baselineRisk,
    residualRisk,
    riskReductionPct,
    protectedAssetsPct,
    perimeterCoveredPct,
    layerReadinessPct: Math.min(1, layerCoverageAvg),
    layerCoverage,
    costPerRiskPointRub,
    valuePerRuble,
  };
}

export function recommendNextMoves(
  configuration: Configuration,
  context: EvalContext,
  budgetRub: number,
  limit = 3,
): Recommendation[] {
  const current = evaluateConfiguration(configuration, context);

  const candidates = context.catalog.assets
    .filter((asset) => !configuration.placements.some((placement) => placement.assetId === asset.id))
    .map((asset) => {
      const candidatePlacement = {
        id: `${configuration.facilityId}-${configuration.scenarioId}-${asset.id}-candidate`,
        assetId: asset.id,
        facilityId: configuration.facilityId,
        scenarioId: configuration.scenarioId,
        qty: 1,
        readiness: 0.72,
        layerGapBoost: 1.08,
        criticalityBoost: 1.05,
        feasibility: 0.8,
        environmentModifier: 0.92,
      } as const;
      const nextConfig: Configuration = {
        ...configuration,
        placements: [...configuration.placements, candidatePlacement],
      };

      const next = evaluateConfiguration(nextConfig, context);
      const deltaRisk = Math.max(0, current.residualRisk - next.residualRisk);
      const deltaTco = Math.max(1, next.tco3yRub - current.tco3yRub);
      const score =
        (deltaRisk / deltaTco) *
        candidatePlacement.layerGapBoost *
        candidatePlacement.criticalityBoost *
        candidatePlacement.feasibility;
      const deltaResidualRiskPct = current.baselineRisk > 0 ? deltaRisk / current.baselineRisk : 0;

      return {
        candidateAssetId: asset.id,
        candidateAssetName: asset.name,
        affectedLayerIds: asset.layerIds,
        reason: describeRecommendation(asset, context.layers),
        deltaRisk,
        deltaResidualRiskPct,
        deltaTco,
        score,
      } satisfies Recommendation;
    })
    .filter((recommendation) => recommendation.deltaTco <= budgetRub)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return candidates;
}
