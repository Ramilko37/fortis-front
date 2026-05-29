import { evaluateConfiguration, recommendNextMoves } from "@/modules/drone-defense/domain/evaluation";
import {
  buildCatalogResponse,
  buildScenarioConfiguration,
  defenseAssets,
  defenseLayers,
  facilities,
  hexCells,
  threatRoutes,
} from "@/modules/drone-defense/infra/mock-defense-data";
import type {
  Configuration,
  DefenseCatalogResponse,
  DefenseLayersResponse,
  DefenseScenarioId,
  EvaluateRequest,
  KpiResult,
  RecommendRequest,
  Recommendation,
} from "@/shared/types/drone-defense";

const assetsById = new Map(defenseAssets.map((asset) => [asset.id, asset]));

function getScenarioConfiguration(
  facilityId: string,
  scenarioId: DefenseScenarioId,
): Configuration {
  return buildScenarioConfiguration(facilityId, scenarioId);
}

export async function getCatalog(): Promise<DefenseCatalogResponse> {
  return buildCatalogResponse();
}

export async function getFacilities() {
  return facilities;
}

export async function getThreatRoutes() {
  return threatRoutes;
}

export async function getHexCells() {
  return hexCells;
}

export async function getLayers(
  facilityId: string,
  scenarioId: DefenseScenarioId,
  configuration = getScenarioConfiguration(facilityId, scenarioId),
): Promise<DefenseLayersResponse> {
  const kpi = evaluateConfiguration(configuration, {
    catalog: buildCatalogResponse(),
    assetsById,
    cells: hexCells,
    layers: defenseLayers,
    facilities,
  });

  return {
    facilityId,
    scenarioId,
    layerCoverage: kpi.layerCoverage.map((item) => ({
      layerId: item.layerId,
      coveredPct: item.coveredPct,
      distanceBandM: item.distanceBandM,
    })),
  };
}

export async function evaluateDefense(request: EvaluateRequest): Promise<KpiResult> {
  return evaluateConfiguration(request.configuration, {
    catalog: buildCatalogResponse(),
    assetsById,
    cells: hexCells,
    layers: defenseLayers,
    facilities,
  });
}

export async function recommendDefense(request: RecommendRequest): Promise<Recommendation[]> {
  return recommendNextMoves(
    request.configuration,
    {
      catalog: buildCatalogResponse(),
      assetsById,
      cells: hexCells,
      layers: defenseLayers,
      facilities,
    },
    request.budgetRub,
    request.limit ?? 3,
  );
}
