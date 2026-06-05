import type { DefenseLayerId, Placement } from "@/shared/types/drone-defense";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

export type BuildAssetIcon = {
  groupId: string;
  layerId: DefenseLayerId;
  label: string;
  imageUrl: string;
  isPlaceholder?: boolean;
};

export type BuildCatalogGroup = {
  id: string;
  layerId: DefenseLayerId;
  name: string;
};

export type SlotBuildOption = {
  groupId: string;
  label: string;
  imageUrl: string;
  isPlaceholder: boolean;
};

export type CatalogGroupBuildOption = SlotBuildOption & {
  layerId: DefenseLayerId;
};

export type CatalogGroupSlotPlacementCheck = {
  canPlace: boolean;
  reason: "available" | "unknown-group" | "wrong-layer" | "slot-occupied" | "already-placed";
  message: string;
};

const placeholderByLayer: Record<DefenseLayerId, string> = {
  layer_01_external_warning: "/drone-defense/echelons/l1/regional-mchs-center.png",
  layer_02_detection: "/drone-defense/echelons/l2/radar-station.png",
  layer_03_identification: "/drone-defense/echelons/placeholders/l3.svg",
  layer_04_suppression: "/drone-defense/echelons/placeholders/l4.svg",
  layer_05_mid_range_kinetic: "/drone-defense/echelons/placeholders/l5.svg",
  layer_06_last_line_kinetic: "/drone-defense/echelons/placeholders/l6.svg",
  layer_07_accuracy_disruption: "/drone-defense/echelons/placeholders/l7.svg",
  layer_08_passive_protection: "/drone-defense/echelons/placeholders/l8.svg",
  layer_09_hardening: "/drone-defense/echelons/placeholders/l9.svg",
};

const buildAssetIcons: BuildAssetIcon[] = [
  { groupId: "l1-emergency-centers", layerId: "layer_01_external_warning", label: "МЧС", imageUrl: "/drone-defense/echelons/l1/regional-mchs-center.png" },
  { groupId: "l1-military-command", layerId: "layer_01_external_warning", label: "Комендатура", imageUrl: "/drone-defense/echelons/l1/military-command-post.png" },
  { groupId: "l1-regional-hq", layerId: "layer_01_external_warning", label: "Штаб", imageUrl: "/drone-defense/echelons/l1/regional-operations-hq-fsb-curator.png" },
  { groupId: "l1-neighbor-network", layerId: "layer_01_external_warning", label: "Соседи", imageUrl: "/drone-defense/echelons/l1/neighbor-enterprise-network-station.png" },
  { groupId: "l1-osint", layerId: "layer_01_external_warning", label: "OSINT", imageUrl: "/drone-defense/echelons/l1/osint-monitoring-workstation.png" },
  { groupId: "l2-radar", layerId: "layer_02_detection", label: "РЛС", imageUrl: "/drone-defense/echelons/l2/radar-station.png" },
  { groupId: "l2-optical", layerId: "layer_02_detection", label: "ОЭП", imageUrl: "/drone-defense/echelons/l2/optoelectronic-system.png" },
  { groupId: "l2-thermal", layerId: "layer_02_detection", label: "Тепло", imageUrl: "/drone-defense/echelons/l2/thermal-imaging-system.png" },
  { groupId: "l2-acoustic", layerId: "layer_02_detection", label: "Акустика", imageUrl: "/drone-defense/echelons/l2/acoustic-array.png" },
  { groupId: "l2-rf-passive", layerId: "layer_02_detection", label: "RF", imageUrl: "/drone-defense/echelons/l2/passive-rf-detector.png" },
  { groupId: "l3-classification", layerId: "layer_03_identification", label: "Классиф.", imageUrl: "/drone-defense/echelons/l2/target-classification-software.png" },
  { groupId: "l4-ew-gnss", layerId: "layer_04_suppression", label: "GNSS", imageUrl: placeholderByLayer.layer_04_suppression, isPlaceholder: true },
  { groupId: "l4-ew-radio", layerId: "layer_04_suppression", label: "РЭБ", imageUrl: placeholderByLayer.layer_04_suppression, isPlaceholder: true },
  { groupId: "l4-gps-spoof", layerId: "layer_04_suppression", label: "Спуф", imageUrl: placeholderByLayer.layer_04_suppression, isPlaceholder: true },
  { groupId: "l4-microwave", layerId: "layer_04_suppression", label: "СВЧ", imageUrl: placeholderByLayer.layer_04_suppression, isPlaceholder: true },
  { groupId: "l4-laser", layerId: "layer_04_suppression", label: "Лазер", imageUrl: placeholderByLayer.layer_04_suppression, isPlaceholder: true },
  { groupId: "l5-mobile-fire", layerId: "layer_05_mid_range_kinetic", label: "МОГ", imageUrl: placeholderByLayer.layer_05_mid_range_kinetic, isPlaceholder: true },
  { groupId: "l5-bars", layerId: "layer_05_mid_range_kinetic", label: "БАРС", imageUrl: placeholderByLayer.layer_05_mid_range_kinetic, isPlaceholder: true },
  { groupId: "l5-interceptor", layerId: "layer_05_mid_range_kinetic", label: "Перехв.", imageUrl: placeholderByLayer.layer_05_mid_range_kinetic, isPlaceholder: true },
  { groupId: "l5-turret", layerId: "layer_05_mid_range_kinetic", label: "Турель", imageUrl: placeholderByLayer.layer_05_mid_range_kinetic, isPlaceholder: true },
  { groupId: "l6-zrpk", layerId: "layer_06_last_line_kinetic", label: "ЗРПК", imageUrl: placeholderByLayer.layer_06_last_line_kinetic, isPlaceholder: true },
  { groupId: "l6-pzrk", layerId: "layer_06_last_line_kinetic", label: "ПЗРК", imageUrl: placeholderByLayer.layer_06_last_line_kinetic, isPlaceholder: true },
  { groupId: "l6-barrel", layerId: "layer_06_last_line_kinetic", label: "ПВО", imageUrl: placeholderByLayer.layer_06_last_line_kinetic, isPlaceholder: true },
  { groupId: "l7-camouflage", layerId: "layer_07_accuracy_disruption", label: "Маск.", imageUrl: placeholderByLayer.layer_07_accuracy_disruption, isPlaceholder: true },
  { groupId: "l7-smoke", layerId: "layer_07_accuracy_disruption", label: "Дым", imageUrl: placeholderByLayer.layer_07_accuracy_disruption, isPlaceholder: true },
  { groupId: "l7-thermal-decoy", layerId: "layer_07_accuracy_disruption", label: "ИК", imageUrl: placeholderByLayer.layer_07_accuracy_disruption, isPlaceholder: true },
  { groupId: "l7-decoys", layerId: "layer_07_accuracy_disruption", label: "Макет", imageUrl: placeholderByLayer.layer_07_accuracy_disruption, isPlaceholder: true },
  { groupId: "l7-contrast", layerId: "layer_07_accuracy_disruption", label: "Контраст", imageUrl: placeholderByLayer.layer_07_accuracy_disruption, isPlaceholder: true },
  { groupId: "l8-anti-drone-nets", layerId: "layer_08_passive_protection", label: "Сетки", imageUrl: placeholderByLayer.layer_08_passive_protection, isPlaceholder: true },
  { groupId: "l8-cable-systems", layerId: "layer_08_passive_protection", label: "Тросы", imageUrl: placeholderByLayer.layer_08_passive_protection, isPlaceholder: true },
  { groupId: "l8-domes", layerId: "layer_08_passive_protection", label: "Купол", imageUrl: placeholderByLayer.layer_08_passive_protection, isPlaceholder: true },
  { groupId: "l9-spacing", layerId: "layer_09_hardening", label: "Разнос", imageUrl: placeholderByLayer.layer_09_hardening, isPlaceholder: true },
  { groupId: "l9-armoring", layerId: "layer_09_hardening", label: "Броня", imageUrl: placeholderByLayer.layer_09_hardening, isPlaceholder: true },
];

const buildAssetByGroupId = new Map(buildAssetIcons.map((asset) => [asset.groupId, asset]));

export function getBuildAssetForCatalogGroup(groupId: string) {
  return buildAssetByGroupId.get(groupId) ?? null;
}

export function getBuildAssetsForLayer(layerId: DefenseLayerId) {
  return buildAssetIcons.filter((asset) => asset.layerId === layerId);
}

export function getBuildOptionForCatalogGroup({
  groupId,
  placements,
}: {
  groupId: string;
  placements: Placement[];
}): CatalogGroupBuildOption | null {
  void placements;
  const asset = getBuildAssetForCatalogGroup(groupId);
  if (!asset) return null;

  return {
    groupId: asset.groupId,
    layerId: asset.layerId,
    label: asset.label,
    imageUrl: asset.imageUrl,
    isPlaceholder: Boolean(asset.isPlaceholder),
  };
}

export function canPlaceCatalogGroupInSlot({
  groupId,
  slot,
  placements,
}: {
  groupId: string;
  slot: EchelonMapSlot;
  placements: Placement[];
}): CatalogGroupSlotPlacementCheck {
  const asset = getBuildAssetForCatalogGroup(groupId);
  if (!asset) {
    return {
      canPlace: false,
      reason: "unknown-group",
      message: "Нельзя установить это средство защиты в выбранной позиции",
    };
  }

  if (asset.layerId !== slot.layerId) {
    return {
      canPlace: false,
      reason: "wrong-layer",
      message: "Нельзя установить это средство защиты в выбранной позиции",
    };
  }

  const hasPlacementInSlot = placements.some((placement) => placement.slotId === slot.id);

  if (slot.status === "occupied" || hasPlacementInSlot) {
    return {
      canPlace: false,
      reason: "slot-occupied",
      message: "Выбранная позиция уже занята",
    };
  }

  const isAlreadyPlaced = placements.some((placement) => placement.catalogGroupId === groupId);
  if (isAlreadyPlaced) {
    return {
      canPlace: false,
      reason: "already-placed",
      message: "Это средство защиты уже установлено",
    };
  }

  return {
    canPlace: true,
    reason: "available",
    message: "Позиция доступна для установки",
  };
}

export function getBuildOptionForSlot({
  slot,
  catalogGroups,
  placements,
}: {
  slot: EchelonMapSlot;
  catalogGroups: BuildCatalogGroup[];
  placements: Placement[];
}): SlotBuildOption | null {
  if (slot.status === "occupied" || placements.some((placement) => placement.slotId === slot.id)) return null;

  const layerGroups = catalogGroups.filter((group) => group.layerId === slot.layerId);
  const group = layerGroups[slot.slotIndex - 1];
  if (!group) return null;

  const asset = getBuildAssetForCatalogGroup(group.id);
  if (!asset) return null;

  const isAlreadyPlaced = placements.some((placement) => placement.catalogGroupId === group.id);
  if (isAlreadyPlaced) return null;

  return {
    groupId: group.id,
    label: asset.label,
    imageUrl: asset.imageUrl,
    isPlaceholder: Boolean(asset.isPlaceholder),
  };
}
