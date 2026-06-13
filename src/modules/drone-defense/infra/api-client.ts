import type {
  Configuration,
  DefenseCatalogResponse,
  DefenseLayersResponse,
  EvaluateRequest,
  Facility,
  KpiResult,
  RecommendRequest,
  Recommendation,
} from "@/shared/types/drone-defense";
import { readJson } from "@/shared/lib/api-client";

type LayersQuery = {
  facilityId: string;
  scenarioId: string;
};

export function fetchCatalog() {
  return readJson<DefenseCatalogResponse>("/api/defense/catalog");
}

export function fetchFacilities() {
  return readJson<Facility[]>("/api/defense/facilities");
}

export function fetchLayers(query: LayersQuery) {
  const params = new URLSearchParams({
    facilityId: query.facilityId,
    scenarioId: query.scenarioId,
  });
  return readJson<DefenseLayersResponse>(`/api/defense/layers?${params.toString()}`);
}

export function evaluateConfigurationRequest(configuration: Configuration, scope: "regional" | "facility") {
  const payload: EvaluateRequest = { configuration, scope };
  return readJson<KpiResult>("/api/defense/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function recommendConfigurationRequest(configuration: Configuration, budgetRub: number) {
  const payload: RecommendRequest = { configuration, budgetRub, limit: 3 };
  return readJson<Recommendation[]>("/api/defense/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export {
  buildAssetLibraryUrl,
  createDefenseAsset,
  deleteDefenseAsset,
  fetchAssetLibrary,
  getDefenseAsset,
  normalizeDefenseAssetPayload,
  updateDefenseAsset,
} from "@/modules/drone-defense/infra/asset-library-api";
