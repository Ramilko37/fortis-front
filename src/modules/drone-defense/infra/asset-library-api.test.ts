// Run: pnpm exec tsx src/modules/drone-defense/infra/asset-library-api.test.ts

import {
  buildAssetLibraryUrl,
  normalizeDefenseAssetPayload,
  serializeDefenseAssetMutation,
} from "@/modules/drone-defense/infra/asset-library-api";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const url = buildAssetLibraryUrl({
  enterpriseId: "enterprise-1",
  isPublic: true,
  category: "radar",
  limit: 50,
  offset: 10,
});

assert(
  url === "/api/v1/assets?enterpriseId=enterprise-1&isPublic=true&category=radar&limit=50&offset=10",
  `asset library list URL must keep backend query names, got ${url}`,
);

const normalized = normalizeDefenseAssetPayload({
  id: "server-radar",
  name: "Серверная РЛС",
  short_name: "СРЛС",
  description: "Каталог из backend",
  category: "radar",
  roles: ["detection"],
  price_per_unit_mln: 42,
  unit_label: "комплект",
  recommended_layer_codes: ["L2"],
  compatible_layer_codes: ["L2", "L3"],
  protection_type: "РЛС",
  max_effective_distance: 75,
  coverage_type: "sector",
  coverage_radius: 75,
  coverage_angle: 120,
  deployment_type: "mobile",
  placement_type: "map-object",
  map_catalog_group_ids: ["l2-radar"],
  is_public: true,
});

assert(normalized.id === "server-radar", "normalizer must keep backend id");
assert(normalized.category === "detection", "backend radar category must map to frontend detection");
assert(normalized.roles.includes("detect"), "backend detection role must map to frontend detect role");
assert(normalized.pricePerUnitMln === 42, "snake_case price must normalize to pricePerUnitMln");
assert(normalized.unitLabel === "комплект", "snake_case unit label must normalize to unitLabel");
assert(normalized.recommendedLayerCodes?.[0] === "L2", "recommended layer codes must normalize");
assert(normalized.coverageType === "sector", "coverage type must normalize");
assert(normalized.maxEffectiveDistance === 75000, "backend maxEffectiveDistance in km must normalize to frontend meters");
assert(normalized.coverageRadius === 75000, "backend coverageRadius in km must normalize to frontend meters");
assert(normalized.coverageAngle === 120, "coverage angle must normalize without unit conversion");
assert(normalized.mapCatalogGroupIds?.[0] === "l2-radar", "map catalog groups must normalize");

const mutation = serializeDefenseAssetMutation({
  id: "server-radar",
  name: "Серверная РЛС",
  category: "detection",
  roles: ["detect"],
  pricePerUnitMln: 42,
  currency: "RUB",
  unitLabel: "шт",
  maxEffectiveDistance: 75000,
  minEffectiveDistance: 5000,
  coverageType: "sector",
  coverageRadius: 75000,
  coverageAngle: 120,
  deploymentType: "mobile",
  placementType: "map-object",
});

assert(mutation.maxEffectiveDistance === 75, "FE maxEffectiveDistance meters must serialize to backend km");
assert(mutation.minEffectiveDistance === 5, "FE minEffectiveDistance meters must serialize to backend km");
assert(mutation.coverageRadius === 75, "FE coverageRadius meters must serialize to backend km");
assert(mutation.coverageAngle === 120, "coverage angle must serialize without unit conversion");

const partial = normalizeDefenseAssetPayload({
  id: "minimal",
  name: "Минимальное средство",
});

assert(partial.category === "infrastructure", "minimal payload must receive a safe frontend category");
assert(partial.roles.length > 0, "minimal payload must receive safe roles");
assert(partial.pricePerUnitMln === null, "missing price must normalize to null");
assert(partial.currency === "RUB", "missing currency must default to RUB");
assert(partial.unitLabel === "шт", "missing unit label must default to шт");
assert(partial.coverageType === "none", "missing coverage type must default to none");
assert(partial.deploymentType === "static", "missing deployment type must default to static");
assert(partial.placementType === "map-object", "missing placement type must default to map-object");

console.log("asset-library-api.test.ts: asset library API contracts passed");
