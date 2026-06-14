import { priceForPlacedObject } from "@/shared/lib/defense-project";
import type { DefenseProject } from "@/shared/types/defense-project";
import type { PlacedDefenseCompoundProfile } from "@/shared/types/defense-configuration";

export type ProjectObjectReportLine = {
  objectId: string;
  layerId: string;
  layerCode: string;
  layerName: string;
  assetId: string;
  assetName: string;
  quantity: number;
  unitPriceMln: number;
  lineTotalMln: number;
  protectionType: string;
  isCompoundPost: boolean;
  compositionSummary?: string;
  weaponSummary?: string;
  azimuthSectorSummary?: string;
};

function normalizeOptionalText(value: string | undefined) {
  return value?.trim() ?? "—";
}

function buildCompoundCompositionSummary(profile: PlacedDefenseCompoundProfile) {
  const equipment = profile.equipment
    ?.filter((item) => Number(item.quantity) > 0)
    .map((item) => `${item.label}: ${item.quantity}`)
    .join(", ");
  return `Пост: ${normalizeOptionalText(profile.postType)} · Л/с: ${normalizeOptionalText(profile.personnelCount)} · Подотчётность: ${normalizeOptionalText(profile.accountability)} · Оснащение: ${equipment || "—"}`;
}

function buildCompoundWeaponSummary(profile: PlacedDefenseCompoundProfile) {
  const weapons = profile.weapons
    ?.filter((item) => Number(item.quantity) > 0)
    .map((item) => `${item.label}: ${item.quantity}`)
    .join(", ");
  if (weapons) return `Оружие: ${weapons}`;
  return `Оружие: ${normalizeOptionalText(profile.armament)} · Ед.: ${normalizeOptionalText(profile.weaponUnits)}`;
}

function buildCompoundAzimuthSummary(profile: PlacedDefenseCompoundProfile) {
  const azimuth = Number.isFinite(profile.azimuth) ? `${profile.azimuth}°` : "—";
  const coverageWeapon = profile.weapons?.find((item) => item.id === profile.coverageWeaponId);
  const coverageWeaponLabel = coverageWeapon ? ` · На карте: ${coverageWeapon.label}` : "";
  return `Азимут: ${azimuth} · Дальность/сектор: ${normalizeOptionalText(profile.sectorOrRange)}${coverageWeaponLabel}`;
}

export function buildProjectReportObjectLines(project: DefenseProject): ProjectObjectReportLine[] {
  const layersById = new Map(project.layers.map((layer) => [layer.id, layer]));
  const assetsById = new Map(project.assetLibrary.map((asset) => [asset.id, asset]));

  return project.placedObjects.map((object) => {
    const layer = layersById.get(object.layerId);
    const asset = assetsById.get(object.assetId);
    const unitPriceMln = priceForPlacedObject(project, object);
    const isCompoundPost = object.compoundProfile?.kind === "compound-post";
    const compoundProfile = object.compoundProfile;

    return {
      objectId: object.id,
      layerId: object.layerId,
      layerCode: layer?.code ?? "—",
      layerName: layer?.name ?? "—",
      assetId: object.assetId,
      assetName: object.name ?? asset?.name ?? object.assetId,
      quantity: object.quantity,
      unitPriceMln,
      lineTotalMln: unitPriceMln * object.quantity,
      protectionType: asset?.protectionType ?? "—",
      isCompoundPost,
      ...(isCompoundPost && compoundProfile
        ? {
            compositionSummary: buildCompoundCompositionSummary(compoundProfile),
            weaponSummary: buildCompoundWeaponSummary(compoundProfile),
            azimuthSectorSummary: buildCompoundAzimuthSummary(compoundProfile),
          }
        : {}),
    };
  });
}
