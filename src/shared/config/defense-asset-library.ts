import { defenseItems } from "@/shared/config/defense-catalog";
import type {
  DefenseAssetCategory,
  DefenseAssetLibraryItem,
  DefenseAssetRole,
} from "@/shared/types/defense-project";

function categoryForItem(itemId: string): DefenseAssetCategory {
  if (itemId.startsWith("l1-")) return "early-warning";
  if (itemId.includes("radar") || itemId.startsWith("l2-")) return "detection";
  if (itemId.includes("classification")) return "classification";
  if (itemId.includes("ew") || itemId.includes("spoof") || itemId.includes("microwave")) return "jamming";
  if (itemId.includes("interceptor")) return "interceptor";
  if (itemId.includes("turret") || itemId.includes("barrel") || itemId.includes("zrpk") || itemId.includes("pzrk")) return "kinetic";
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

export const defenseAssetLibrary: DefenseAssetLibraryItem[] = defenseItems.map((item) => {
  const category = categoryForItem(item.id);
  const recommendedLayerCode = layerCodeFromLayerId(item.layerId);
  const isNonPhysical = item.id.includes("osint") || item.id.includes("command") || item.id.startsWith("l1-");
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
    recommendedLayerCodes: recommendedLayerCode ? [recommendedLayerCode] : undefined,
    coverageRadius: item.coverageWeight ? item.coverageWeight * 100 : undefined,
    deploymentType: isNonPhysical ? "external" : "static",
    placementType: isNonPhysical ? "non-physical" : "map-object",
    score: item.score,
    priority: item.priority,
    tags: item.mapCatalogGroupIds,
    legacyItemId: item.id,
    calculatorAssetId: item.calculatorAssetId,
    mapCatalogGroupIds: item.mapCatalogGroupIds,
  };
});

export function getDefenseAssetById(assetId: string): DefenseAssetLibraryItem | undefined {
  return defenseAssetLibrary.find((item) => item.id === assetId);
}
