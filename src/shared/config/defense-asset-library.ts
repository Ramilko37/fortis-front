import { defenseItems } from "@/shared/config/defense-catalog";
import type {
  DefenseAsset,
  DefenseAssetCategory,
  DefenseAssetCoverageType,
  DefenseAssetRole,
} from "@/shared/types/defense-project";

function categoryForItem(itemId: string): DefenseAssetCategory {
  if (itemId.startsWith("l1-")) return "early-warning";
  if (itemId.includes("radar") || itemId.startsWith("l2-")) return "detection";
  if (itemId.includes("classification")) return "classification";
  if (itemId.includes("ew") || itemId.includes("spoof") || itemId.includes("microwave")) return "jamming";
  if (itemId.includes("interceptor")) return "interceptor";
  if (
    itemId.includes("turret") ||
    itemId.includes("barrel") ||
    itemId.includes("zrpk") ||
    itemId.includes("pzrk") ||
    itemId.includes("laser") ||
    itemId.includes("aircraft") ||
    itemId.includes("armored") ||
    itemId.startsWith("l5-") ||
    itemId.startsWith("l6-")
  ) return "kinetic";
  if (itemId.includes("passive") || itemId.startsWith("l8-")) return "passive-protection";
  if (itemId.includes("atz") || itemId.includes("armoring") || itemId.startsWith("l9-")) return "engineering-protection";
  if (itemId.includes("command")) return "command-center";
  return "infrastructure";
}

function rolesForCategory(category: DefenseAssetCategory): DefenseAssetRole[] {
  switch (category) {
    case "early-warning":
      return ["alert", "monitor"];
    case "detection":
      return ["detect", "track"];
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
      return ["protect", "delay"];
    case "command-center":
      return ["coordinate", "monitor"];
    default:
      return ["monitor"];
  }
}

function layerCodeFromLayerId(layerId?: string): string | undefined {
  const match = layerId?.match(/^layer_(\d+)/);
  return match ? `L${Number(match[1])}` : undefined;
}

const allLayerCodes = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"];

function uniq(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function recommendedLayerCodesForItem(itemId: string, category: DefenseAssetCategory, seedCode?: string) {
  if (category === "detection") return uniq([seedCode, "L2", "L3"]);
  if (category === "classification" || category === "software") return uniq([seedCode, "L2", "L3"]);
  if (category === "jamming" || category === "spoofing") return uniq([seedCode, "L4"]);
  if (category === "kinetic" || category === "interceptor") return uniq([seedCode, "L5", "L6"]);
  if (category === "passive-protection" || category === "engineering-protection") return uniq([seedCode, "L8", "L9"]);
  if (category === "command-center" || category === "external-service" || category === "early-warning") return uniq([seedCode, "L1"]);
  return seedCode ? [seedCode] : [];
}

function compatibleLayerCodesForCategory(category: DefenseAssetCategory) {
  switch (category) {
    case "detection":
      return ["L1", "L2", "L3"];
    case "classification":
    case "software":
      return ["L2", "L3"];
    case "jamming":
    case "spoofing":
      return ["L3", "L4", "L7"];
    case "kinetic":
    case "interceptor":
      return ["L5", "L6"];
    case "passive-protection":
    case "engineering-protection":
      return ["L7", "L8", "L9"];
    case "early-warning":
    case "command-center":
    case "external-service":
      return ["L1", "L2"];
    default:
      return allLayerCodes;
  }
}

function incompatibleLayerCodesForCategory(category: DefenseAssetCategory) {
  switch (category) {
    case "kinetic":
    case "interceptor":
      return ["L1", "L2"];
    case "jamming":
    case "spoofing":
      return ["L8", "L9"];
    default:
      return [];
  }
}

function coverageTypeForCategory(category: DefenseAssetCategory, isNonPhysical: boolean): DefenseAssetCoverageType {
  if (isNonPhysical) return "none";
  if (category === "jamming" || category === "spoofing") return "sector";
  if (category === "passive-protection" || category === "engineering-protection" || category === "infrastructure") return "polygon";
  return "circle";
}

function parseRangeLabel(rangeLabel?: string) {
  if (!rangeLabel) return {};
  const normalized = rangeLabel.replace(",", ".").toLowerCase();
  const numbers = [...normalized.matchAll(/\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const multiplier = normalized.includes("км") ? 1000 : 1;
  if (normalized.includes("до") && numbers[0] !== undefined) {
    return { maxEffectiveDistance: Math.round(numbers[0] * multiplier) };
  }
  if (numbers.length >= 2) {
    return {
      minEffectiveDistance: Math.round(numbers[0] * multiplier),
      maxEffectiveDistance: Math.round(numbers[1] * multiplier),
    };
  }
  return {};
}

export const defenseAssetLibrary: DefenseAsset[] = defenseItems.map((item) => {
  const category = categoryForItem(item.id);
  const seedLayerCode = layerCodeFromLayerId(item.layerId);
  const isNonPhysical = item.id.includes("osint") || item.id.includes("command") || item.id.startsWith("l1-");
  const coverageType = coverageTypeForCategory(category, isNonPhysical);
  const placementType = isNonPhysical
    ? "non-physical"
    : coverageType === "line" || coverageType === "polygon"
      ? "zone-object"
      : "map-object";
  const range = parseRangeLabel(item.rangeLabel);
  return {
    id: item.id,
    name: item.title,
    shortName: item.shortTitle,
    category,
    roles: rolesForCategory(category),
    pricePerUnitMln: item.pricePerUnitMln,
    currency: item.currency,
    unitLabel: item.unitLabel,
    compatibleLayerTypes: ["circle", "ring", "polygon", "freeform"],
    recommendedLayerCodes: recommendedLayerCodesForItem(item.id, category, seedLayerCode),
    compatibleLayerCodes: compatibleLayerCodesForCategory(category),
    incompatibleLayerCodes: incompatibleLayerCodesForCategory(category),
    minEffectiveDistance: range.minEffectiveDistance,
    maxEffectiveDistance: range.maxEffectiveDistance,
    coverageType,
    coverageRadius: isNonPhysical ? undefined : range.maxEffectiveDistance ?? (item.coverageWeight ? item.coverageWeight * 100 : undefined),
    coverageAngle: category === "jamming" || category === "spoofing" ? 90 : undefined,
    deploymentType: isNonPhysical ? "external" : "static",
    placementType,
    score: item.score,
    priority: item.priority,
    tags: item.mapCatalogGroupIds,
    legacyItemId: item.id,
    calculatorAssetId: item.calculatorAssetId,
    mapCatalogGroupIds: item.mapCatalogGroupIds,
  };
});

export function getDefenseAssetById(assetId: string): DefenseAsset | undefined {
  return defenseAssetLibrary.find((item) => item.id === assetId);
}
