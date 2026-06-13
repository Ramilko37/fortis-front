import type { PlacedDefenseObject, DefenseAsset } from "@/shared/types/defense-project";
import type { Placement } from "@/shared/types/drone-defense";

export type ProtectionTypeVisibility = {
  mog: boolean;
};

export const DEFAULT_PROTECTION_TYPE_VISIBILITY: ProtectionTypeVisibility = {
  mog: true,
};

const MOG_ASSET_IDS = new Set(["asset_05_01_mog", "l5-mobile-fire"]);
const MOG_CATALOG_GROUP_IDS = new Set(["l5-mobile-fire"]);

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function isMogProfile(profile?: { kind?: "compound-post"; postType?: string } | null): boolean {
  return Boolean(profile && profile.kind === "compound-post" && normalize(profile.postType) === "мог");
}

export function isMogAsset(asset?: Pick<DefenseAsset, "id" | "protectionType" | "compoundProfile" | "mapCatalogGroupIds"> | null): boolean {
  if (!asset) return false;
  if (MOG_ASSET_IDS.has(asset.id)) return true;
  if (isMogProfile(asset.compoundProfile)) return true;
  if (normalize(asset.protectionType) === "мог") return true;
  return (asset.mapCatalogGroupIds ?? []).some((groupId) => MOG_CATALOG_GROUP_IDS.has(groupId));
}

export function isMogPlacedObject(
  object?: Pick<PlacedDefenseObject, "assetId" | "compoundProfile"> | null,
  asset?: Pick<DefenseAsset, "id" | "protectionType" | "compoundProfile" | "mapCatalogGroupIds"> | null,
): boolean {
  if (!object) return false;
  if (isMogProfile(object.compoundProfile)) return true;
  if (asset && asset.id === object.assetId) {
    return isMogAsset(asset);
  }
  if (MOG_ASSET_IDS.has(object.assetId)) return true;
  return false;
}

export function isMogPlacement(
  placement: Pick<Placement, "catalogGroupId" | "compoundProfile">,
  asset?: Pick<DefenseAsset, "id" | "protectionType" | "compoundProfile" | "mapCatalogGroupIds"> | null,
): boolean {
  if (isMogProfile(placement.compoundProfile)) return true;
  if (placement.catalogGroupId && MOG_CATALOG_GROUP_IDS.has(placement.catalogGroupId)) return true;
  return isMogAsset(asset);
}

export function isProtectionTypeVisibleInMap(visibility: ProtectionTypeVisibility, type: keyof ProtectionTypeVisibility): boolean {
  return visibility[type] !== false;
}

export function isMogVisibleInMap(
  placement: Pick<Placement, "catalogGroupId" | "compoundProfile">,
  asset: Pick<DefenseAsset, "id" | "protectionType" | "compoundProfile" | "mapCatalogGroupIds"> | undefined,
  visibility: ProtectionTypeVisibility,
): boolean {
  if (!isMogPlacement(placement, asset)) return true;
  return isProtectionTypeVisibleInMap(visibility, "mog");
}
