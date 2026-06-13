import { readJson } from "@/modules/drone-defense/infra/api-client";
import type {
  DefenseAsset,
  DefenseAssetCategory,
  DefenseAssetCoverageType,
  DefenseAssetRole,
} from "@/shared/types/defense-project";

export type FetchAssetLibraryOptions = {
  enterpriseId?: string;
  isPublic?: boolean;
  category?: string;
  limit?: number;
  offset?: number;
};

export type DefenseAssetMutationInput = Partial<DefenseAsset> & {
  name: string;
  category: DefenseAssetCategory;
  coverageType: DefenseAssetCoverageType;
};

type BackendAssetPayload = Record<string, unknown>;

type BackendAssetListResponse = {
  items?: BackendAssetPayload[];
  totalItems?: number;
};

const assetLibraryPath = "/api/v1/assets";

const frontendCategories = new Set<DefenseAssetCategory>([
  "early-warning",
  "detection",
  "classification",
  "jamming",
  "spoofing",
  "kinetic",
  "interceptor",
  "passive-protection",
  "engineering-protection",
  "infrastructure",
  "software",
  "command-center",
  "external-service",
]);

const frontendRoles = new Set<DefenseAssetRole>([
  "detect",
  "track",
  "classify",
  "suppress",
  "destroy",
  "delay",
  "protect",
  "coordinate",
  "monitor",
  "alert",
]);

const coverageTypes = new Set<DefenseAssetCoverageType>(["circle", "sector", "line", "polygon", "none"]);

function valueOf(payload: BackendAssetPayload, camelKey: string, snakeKey?: string) {
  return payload[camelKey] ?? (snakeKey ? payload[snakeKey] : undefined);
}

function stringValue(payload: BackendAssetPayload, camelKey: string, snakeKey?: string) {
  const value = valueOf(payload, camelKey, snakeKey);
  return typeof value === "string" ? value : undefined;
}

function booleanValue(payload: BackendAssetPayload, camelKey: string, snakeKey?: string) {
  const value = valueOf(payload, camelKey, snakeKey);
  return typeof value === "boolean" ? value : undefined;
}

function numberValue(payload: BackendAssetPayload, camelKey: string, snakeKey?: string) {
  const value = valueOf(payload, camelKey, snakeKey);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function kilometersToMeters(value: number | undefined) {
  return value === undefined ? undefined : Math.round(value * 1000);
}

function metersToKilometers(value: number | undefined) {
  return value === undefined ? undefined : value / 1000;
}

function stringArrayValue(payload: BackendAssetPayload, camelKey: string, snakeKey?: string) {
  const value = valueOf(payload, camelKey, snakeKey);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : undefined;
}

function objectValue<T extends object>(payload: BackendAssetPayload, camelKey: string, snakeKey?: string): T | undefined {
  const value = valueOf(payload, camelKey, snakeKey);
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : undefined;
}

function mapBackendCategory(category?: string): DefenseAssetCategory {
  if (category && frontendCategories.has(category as DefenseAssetCategory)) return category as DefenseAssetCategory;
  switch (category) {
    case "radiotechnical":
    case "radar":
      return "detection";
    case "electronic-warfare":
      return "jamming";
    case "missile":
    case "anti-missile":
      return "interceptor";
    case "shturmovaya":
    case "artillery":
    case "aircraft":
    case "helicopter":
    case "uav":
    case "ship":
      return "kinetic";
    case "fortification":
      return "passive-protection";
    case "infrastructure":
      return "infrastructure";
    default:
      return "infrastructure";
  }
}

function mapFrontendCategory(category: DefenseAssetCategory) {
  switch (category) {
    case "early-warning":
    case "command-center":
      return "radiotechnical";
    case "detection":
    case "classification":
      return "radar";
    case "jamming":
    case "spoofing":
      return "electronic-warfare";
    case "interceptor":
      return "missile";
    case "kinetic":
      return "shturmovaya";
    case "passive-protection":
    case "engineering-protection":
      return "fortification";
    case "software":
    case "external-service":
    case "infrastructure":
    default:
      return "infrastructure";
  }
}

function mapBackendRole(role: string): DefenseAssetRole {
  if (frontendRoles.has(role as DefenseAssetRole)) return role as DefenseAssetRole;
  switch (role) {
    case "detection":
      return "detect";
    case "destruction":
      return "destroy";
    case "ew":
      return "suppress";
    case "c2":
      return "coordinate";
    case "cover":
    case "engineering":
      return "protect";
    case "deception":
      return "delay";
    case "recon":
    case "supply":
    case "special":
      return "monitor";
    default:
      return "monitor";
  }
}

function mapFrontendRole(role: DefenseAssetRole) {
  switch (role) {
    case "detect":
    case "track":
      return "detection";
    case "classify":
      return "recon";
    case "suppress":
      return "ew";
    case "destroy":
      return "destruction";
    case "protect":
      return "cover";
    case "coordinate":
      return "c2";
    case "delay":
      return "deception";
    case "alert":
    case "monitor":
    default:
      return "recon";
  }
}

function defaultRolesForCategory(category: DefenseAssetCategory): DefenseAssetRole[] {
  switch (category) {
    case "detection":
      return ["detect"];
    case "classification":
      return ["classify"];
    case "jamming":
    case "spoofing":
      return ["suppress"];
    case "kinetic":
    case "interceptor":
      return ["destroy"];
    case "passive-protection":
    case "engineering-protection":
      return ["protect"];
    case "command-center":
      return ["coordinate"];
    case "early-warning":
      return ["alert"];
    default:
      return ["monitor"];
  }
}

function normalizeCoverageType(value?: string): DefenseAssetCoverageType {
  return coverageTypes.has(value as DefenseAssetCoverageType) ? (value as DefenseAssetCoverageType) : "none";
}

function normalizeDeploymentType(value?: string): DefenseAsset["deploymentType"] {
  if (value === "mobile" || value === "infrastructure" || value === "software" || value === "external") return value;
  return "static";
}

function normalizePlacementType(value?: string): DefenseAsset["placementType"] {
  if (value === "zone-object" || value === "non-physical") return value;
  return "map-object";
}

function normalizePriority(value?: string): DefenseAsset["priority"] {
  if (value === "primary" || value === "medium" || value === "low") return value;
  if (value === "critical" || value === "high") return "primary";
  return undefined;
}

function cleanString(value: string | undefined) {
  return value?.trim() || undefined;
}

export function buildAssetLibraryUrl(options: FetchAssetLibraryOptions = {}) {
  const params = new URLSearchParams();
  if (options.enterpriseId) params.set("enterpriseId", options.enterpriseId);
  if (options.isPublic !== undefined) params.set("isPublic", String(options.isPublic));
  if (options.category) params.set("category", options.category);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  const query = params.toString();
  return query ? `${assetLibraryPath}?${query}` : assetLibraryPath;
}

export function normalizeDefenseAssetPayload(payload: BackendAssetPayload): DefenseAsset {
  const category = mapBackendCategory(stringValue(payload, "category"));
  const roles = (stringArrayValue(payload, "roles") ?? []).map(mapBackendRole);
  const coverageType = normalizeCoverageType(stringValue(payload, "coverageType", "coverage_type"));
  const pricePerUnitMln = numberValue(payload, "pricePerUnitMln", "price_per_unit_mln") ?? null;
  const id = cleanString(stringValue(payload, "id")) ?? crypto.randomUUID();
  const name = cleanString(stringValue(payload, "name")) ?? "Средство защиты";

  return {
    id,
    name,
    shortName: cleanString(stringValue(payload, "shortName", "short_name")),
    description: cleanString(stringValue(payload, "description")),
    category,
    roles: roles.length > 0 ? [...new Set(roles)] : defaultRolesForCategory(category),
    pricePerUnitMln,
    currency: "RUB",
    unitLabel: cleanString(stringValue(payload, "unitLabel", "unit_label")) ?? "шт",
    compatibleLayerTypes: stringArrayValue(payload, "compatibleLayerTypes", "compatible_layer_types") as DefenseAsset["compatibleLayerTypes"],
    recommendedLayerCodes: stringArrayValue(payload, "recommendedLayerCodes", "recommended_layer_codes") ?? [],
    compatibleLayerCodes: stringArrayValue(payload, "compatibleLayerCodes", "compatible_layer_codes") ?? [],
    incompatibleLayerCodes: stringArrayValue(payload, "incompatibleLayerCodes", "incompatible_layer_codes") ?? [],
    protectionType: cleanString(stringValue(payload, "protectionType", "protection_type")),
    minEffectiveDistance: kilometersToMeters(numberValue(payload, "minEffectiveDistance", "min_effective_distance")),
    maxEffectiveDistance: kilometersToMeters(numberValue(payload, "maxEffectiveDistance", "max_effective_distance")),
    coverageType,
    coverageRadius: kilometersToMeters(numberValue(payload, "coverageRadius", "coverage_radius")),
    coverageAngle: numberValue(payload, "coverageAngle", "coverage_angle"),
    deploymentType: normalizeDeploymentType(stringValue(payload, "deploymentType", "deployment_type")),
    placementType: normalizePlacementType(stringValue(payload, "placementType", "placement_type")),
    iconUrl: cleanString(stringValue(payload, "iconUrl", "icon_url")),
    modelUrl: cleanString(stringValue(payload, "modelUrl", "model_url")),
    score: numberValue(payload, "score"),
    priority: normalizePriority(stringValue(payload, "priority")),
    compoundProfile: objectValue(payload, "compoundProfile", "compound_profile"),
    weaponSpec: objectValue(payload, "weaponSpec", "weapon_spec"),
    detectionSpec: objectValue(payload, "detectionSpec", "detection_spec"),
    ewSpec: objectValue(payload, "ewSpec", "ew_spec"),
    tags: stringArrayValue(payload, "tags") ?? [],
    legacyItemId: cleanString(stringValue(payload, "legacyItemId", "legacy_item_id")),
    calculatorAssetId: cleanString(stringValue(payload, "calculatorAssetId", "calculator_asset_id")) ?? null,
    mapCatalogGroupIds: stringArrayValue(payload, "mapCatalogGroupIds", "map_catalog_group_ids") ?? [],
    enterpriseId: stringValue(payload, "enterpriseId", "enterprise_id") ?? null,
    isPublic: booleanValue(payload, "isPublic", "is_public") ?? false,
  };
}

export function serializeDefenseAssetMutation(input: DefenseAssetMutationInput | Partial<DefenseAsset>) {
  return {
    name: input.name,
    shortName: input.shortName,
    description: input.description,
    category: input.category ? mapFrontendCategory(input.category) : undefined,
    roles: input.roles?.map(mapFrontendRole),
    pricePerUnitMln: input.pricePerUnitMln,
    currency: "RUB",
    unitLabel: input.unitLabel,
    compatibleLayerTypes: input.compatibleLayerTypes,
    recommendedLayerCodes: input.recommendedLayerCodes,
    compatibleLayerCodes: input.compatibleLayerCodes,
    incompatibleLayerCodes: input.incompatibleLayerCodes,
    protectionType: input.protectionType,
    minEffectiveDistance: metersToKilometers(input.minEffectiveDistance),
    maxEffectiveDistance: metersToKilometers(input.maxEffectiveDistance),
    coverageType: input.coverageType,
    coverageRadius: metersToKilometers(input.coverageRadius),
    coverageAngle: input.coverageAngle,
    deploymentType: input.deploymentType,
    placementType: input.placementType,
    iconUrl: input.iconUrl,
    modelUrl: input.modelUrl,
    score: input.score,
    priority: input.priority,
    compoundProfile: input.compoundProfile,
    weaponSpec: input.weaponSpec,
    detectionSpec: input.detectionSpec,
    ewSpec: input.ewSpec,
    tags: input.tags,
    legacyItemId: input.legacyItemId,
    calculatorAssetId: input.calculatorAssetId,
    mapCatalogGroupIds: input.mapCatalogGroupIds,
    enterpriseId: input.enterpriseId ?? undefined,
    isPublic: input.isPublic ?? false,
  };
}

export async function fetchAssetLibrary(options: FetchAssetLibraryOptions = {}) {
  const response = await readJson<BackendAssetListResponse | BackendAssetPayload[]>(buildAssetLibraryUrl(options));
  const items = Array.isArray(response) ? response : response.items ?? [];
  return items.map(normalizeDefenseAssetPayload);
}

export async function getDefenseAsset(id: string) {
  const params = new URLSearchParams({ id });
  const response = await readJson<BackendAssetPayload>(`${assetLibraryPath}/get?${params.toString()}`);
  return normalizeDefenseAssetPayload(response);
}

export async function createDefenseAsset(data: DefenseAssetMutationInput) {
  const response = await readJson<BackendAssetPayload>(assetLibraryPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serializeDefenseAssetMutation(data)),
  });
  return normalizeDefenseAssetPayload(response);
}

export async function updateDefenseAsset(id: string, data: Partial<DefenseAsset>) {
  const params = new URLSearchParams({ id });
  const response = await readJson<BackendAssetPayload>(`${assetLibraryPath}/update?${params.toString()}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(serializeDefenseAssetMutation(data)),
  });
  return normalizeDefenseAssetPayload(response);
}

export async function deleteDefenseAsset(id: string) {
  const params = new URLSearchParams({ id });
  await readJson<{ status: string }>(`${assetLibraryPath}/delete?${params.toString()}`, {
    method: "DELETE",
  });
}
