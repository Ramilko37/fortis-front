import type { DefenseLayerId, Placement } from "@/shared/types/drone-defense";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

export type BuildAssetIcon = {
  groupId: string;
  layerId: DefenseLayerId;
  label: string;
  imageUrl: string;
  previewImageUrl: string;
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
  previewImageUrl: string;
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

const defenseAssetImage = {
  acousticDetection: "/drone-defense/assets/acoustic-detection.avif",
  bars: "/drone-defense/assets/bars.avif",
  camouflageNets: "/drone-defense/assets/camouflage-nets.avif",
  contrastReduction: "/drone-defense/assets/contrast-reduction.avif",
  decoys: "/drone-defense/assets/decoys.avif",
  domesAerostats: "/drone-defense/assets/domes-aerostats.avif",
  automaticWeapons: "/drone-defense/assets/automatic-weapons.avif",
  interceptorDrones: "/drone-defense/assets/interceptor-drones.avif",
  jammingGenerator: "/drone-defense/assets/jamming-generator.avif",
  laser: "/drone-defense/assets/laser.avif",
  microwaveWeapon: "/drone-defense/assets/microwave-weapon.avif",
  mogMobileFireGroup: "/drone-defense/assets/mog-mobile-fire-group.avif",
  mogMountedSystem: "/drone-defense/assets/mog-mounted-system.avif",
  opticalDetection: "/drone-defense/assets/optical-detection.avif",
  passiveItzBundle: "/drone-defense/assets/passive-itz-bundle.avif",
  pzrk: "/drone-defense/assets/pzrk.avif",
  radar: "/drone-defense/assets/radar.avif",
  rfDetection: "/drone-defense/assets/rf-detection.avif",
  smokeGeneration: "/drone-defense/assets/smoke-generation.avif",
  spoofers: "/drone-defense/assets/spoofers.avif",
  thermalDecoys: "/drone-defense/assets/thermal-decoys.avif",
  zak: "/drone-defense/assets/zak.avif",
  zrpk: "/drone-defense/assets/zrpk.avif",
};

const defenseAssetPreview = {
  acousticDetection: "/drone-defense/assets/thumbs/acoustic-detection.avif",
  bars: "/drone-defense/assets/thumbs/bars.avif",
  camouflageNets: "/drone-defense/assets/thumbs/camouflage-nets.avif",
  contrastReduction: "/drone-defense/assets/thumbs/contrast-reduction.avif",
  decoys: "/drone-defense/assets/thumbs/decoys.avif",
  domesAerostats: "/drone-defense/assets/thumbs/domes-aerostats.avif",
  automaticWeapons: "/drone-defense/assets/thumbs/automatic-weapons.avif",
  interceptorDrones: "/drone-defense/assets/thumbs/interceptor-drones.avif",
  jammingGenerator: "/drone-defense/assets/thumbs/jamming-generator.avif",
  laser: "/drone-defense/assets/thumbs/laser.avif",
  microwaveWeapon: "/drone-defense/assets/thumbs/microwave-weapon.avif",
  mogMobileFireGroup: "/drone-defense/assets/thumbs/mog-mobile-fire-group.avif",
  mogMountedSystem: "/drone-defense/assets/thumbs/mog-mounted-system.avif",
  opticalDetection: "/drone-defense/assets/thumbs/optical-detection.avif",
  passiveItzBundle: "/drone-defense/assets/thumbs/passive-itz-bundle.avif",
  pzrk: "/drone-defense/assets/thumbs/pzrk.avif",
  radar: "/drone-defense/assets/thumbs/radar.avif",
  rfDetection: "/drone-defense/assets/thumbs/rf-detection.avif",
  smokeGeneration: "/drone-defense/assets/thumbs/smoke-generation.avif",
  spoofers: "/drone-defense/assets/thumbs/spoofers.avif",
  thermalDecoys: "/drone-defense/assets/thumbs/thermal-decoys.avif",
  zak: "/drone-defense/assets/thumbs/zak.avif",
  zrpk: "/drone-defense/assets/thumbs/zrpk.avif",
};

const buildAssetIcons: BuildAssetIcon[] = [
  {
    groupId: "l1-emergency-centers",
    layerId: "layer_01_external_warning",
    label: "МЧС",
    imageUrl: "/drone-defense/echelons/l1/regional-mchs-center.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/regional-mchs-center.avif",
  },
  {
    groupId: "l1-military-command",
    layerId: "layer_01_external_warning",
    label: "Комендатура",
    imageUrl: "/drone-defense/echelons/l1/military-command-post.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/military-command-post.avif",
  },
  {
    groupId: "l1-regional-hq",
    layerId: "layer_01_external_warning",
    label: "Штаб",
    imageUrl: "/drone-defense/echelons/l1/regional-operations-hq-fsb-curator.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/regional-operations-hq-fsb-curator.avif",
  },
  {
    groupId: "l1-neighbor-network",
    layerId: "layer_01_external_warning",
    label: "Соседи",
    imageUrl: "/drone-defense/echelons/l1/neighbor-enterprise-network-station.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/neighbor-enterprise-network-station.avif",
  },
  {
    groupId: "l1-osint",
    layerId: "layer_01_external_warning",
    label: "OSINT",
    imageUrl: "/drone-defense/echelons/l1/osint-monitoring-workstation.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/osint-monitoring-workstation.avif",
  },
  {
    groupId: "l2-radar",
    layerId: "layer_02_detection",
    label: "РЛС",
    imageUrl: defenseAssetImage.radar,
    previewImageUrl: defenseAssetPreview.radar,
  },
  {
    groupId: "l2-optical",
    layerId: "layer_02_detection",
    label: "ОЭП",
    imageUrl: defenseAssetImage.opticalDetection,
    previewImageUrl: defenseAssetPreview.opticalDetection,
  },
  {
    groupId: "l2-thermal",
    layerId: "layer_02_detection",
    label: "Тепло",
    imageUrl: "/drone-defense/echelons/l2/thermal-imaging-system.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/thermal-imaging-system.avif",
  },
  {
    groupId: "l2-acoustic",
    layerId: "layer_02_detection",
    label: "Акустика",
    imageUrl: defenseAssetImage.acousticDetection,
    previewImageUrl: defenseAssetPreview.acousticDetection,
  },
  {
    groupId: "l2-rf-passive",
    layerId: "layer_02_detection",
    label: "RF",
    imageUrl: defenseAssetImage.rfDetection,
    previewImageUrl: defenseAssetPreview.rfDetection,
  },
  {
    groupId: "l3-classification",
    layerId: "layer_03_identification",
    label: "Классиф.",
    imageUrl: "/drone-defense/echelons/l2/target-classification-software.png",
    previewImageUrl: "/drone-defense/echelons/thumbs/target-classification-software.avif",
  },
  {
    groupId: "l4-ew-gnss",
    layerId: "layer_04_suppression",
    label: "GNSS",
    imageUrl: defenseAssetImage.jammingGenerator,
    previewImageUrl: defenseAssetPreview.jammingGenerator,
  },
  {
    groupId: "l4-ew-radio",
    layerId: "layer_04_suppression",
    label: "РЭБ",
    imageUrl: defenseAssetImage.jammingGenerator,
    previewImageUrl: defenseAssetPreview.jammingGenerator,
  },
  {
    groupId: "l4-gps-spoof",
    layerId: "layer_04_suppression",
    label: "Спуф",
    imageUrl: defenseAssetImage.spoofers,
    previewImageUrl: defenseAssetPreview.spoofers,
  },
  {
    groupId: "l4-microwave",
    layerId: "layer_04_suppression",
    label: "СВЧ",
    imageUrl: defenseAssetImage.microwaveWeapon,
    previewImageUrl: defenseAssetPreview.microwaveWeapon,
  },
  {
    groupId: "l4-laser",
    layerId: "layer_04_suppression",
    label: "Лазер",
    imageUrl: defenseAssetImage.laser,
    previewImageUrl: defenseAssetPreview.laser,
  },
  {
    groupId: "l5-mobile-fire",
    layerId: "layer_05_mid_range_kinetic",
    label: "МОГ",
    imageUrl: defenseAssetImage.mogMobileFireGroup,
    previewImageUrl: defenseAssetPreview.mogMobileFireGroup,
  },
  {
    groupId: "l5-bars",
    layerId: "layer_05_mid_range_kinetic",
    label: "БАРС",
    imageUrl: defenseAssetImage.bars,
    previewImageUrl: defenseAssetPreview.bars,
  },
  {
    groupId: "l5-interceptor",
    layerId: "layer_05_mid_range_kinetic",
    label: "Перехв.",
    imageUrl: defenseAssetImage.interceptorDrones,
    previewImageUrl: defenseAssetPreview.interceptorDrones,
  },
  {
    groupId: "l5-turret",
    layerId: "layer_05_mid_range_kinetic",
    label: "Турель",
    imageUrl: defenseAssetImage.mogMountedSystem,
    previewImageUrl: defenseAssetPreview.mogMountedSystem,
  },
  {
    groupId: "l6-zrpk",
    layerId: "layer_06_last_line_kinetic",
    label: "ЗРПК",
    imageUrl: defenseAssetImage.zrpk,
    previewImageUrl: defenseAssetPreview.zrpk,
  },
  {
    groupId: "l6-pzrk",
    layerId: "layer_06_last_line_kinetic",
    label: "ПЗРК",
    imageUrl: defenseAssetImage.pzrk,
    previewImageUrl: defenseAssetPreview.pzrk,
  },
  {
    groupId: "l6-barrel",
    layerId: "layer_06_last_line_kinetic",
    label: "ПВО",
    imageUrl: defenseAssetImage.zak,
    previewImageUrl: defenseAssetPreview.zak,
  },
  {
    groupId: "l7-camouflage",
    layerId: "layer_07_accuracy_disruption",
    label: "Маск.",
    imageUrl: defenseAssetImage.camouflageNets,
    previewImageUrl: defenseAssetPreview.camouflageNets,
  },
  {
    groupId: "l7-smoke",
    layerId: "layer_07_accuracy_disruption",
    label: "Дым",
    imageUrl: defenseAssetImage.smokeGeneration,
    previewImageUrl: defenseAssetPreview.smokeGeneration,
  },
  {
    groupId: "l7-thermal-decoy",
    layerId: "layer_07_accuracy_disruption",
    label: "ИК",
    imageUrl: defenseAssetImage.thermalDecoys,
    previewImageUrl: defenseAssetPreview.thermalDecoys,
  },
  {
    groupId: "l7-decoys",
    layerId: "layer_07_accuracy_disruption",
    label: "Макет",
    imageUrl: defenseAssetImage.decoys,
    previewImageUrl: defenseAssetPreview.decoys,
  },
  {
    groupId: "l7-contrast",
    layerId: "layer_07_accuracy_disruption",
    label: "Контраст",
    imageUrl: defenseAssetImage.contrastReduction,
    previewImageUrl: defenseAssetPreview.contrastReduction,
  },
  {
    groupId: "l8-anti-drone-nets",
    layerId: "layer_08_passive_protection",
    label: "Сетки",
    imageUrl: defenseAssetImage.passiveItzBundle,
    previewImageUrl: defenseAssetPreview.passiveItzBundle,
  },
  {
    groupId: "l8-cable-systems",
    layerId: "layer_08_passive_protection",
    label: "Тросы",
    imageUrl: defenseAssetImage.passiveItzBundle,
    previewImageUrl: defenseAssetPreview.passiveItzBundle,
  },
  {
    groupId: "l8-domes",
    layerId: "layer_08_passive_protection",
    label: "Купол",
    imageUrl: defenseAssetImage.domesAerostats,
    previewImageUrl: defenseAssetPreview.domesAerostats,
  },
  {
    groupId: "l9-spacing",
    layerId: "layer_09_hardening",
    label: "Разнос",
    imageUrl: defenseAssetImage.passiveItzBundle,
    previewImageUrl: defenseAssetPreview.passiveItzBundle,
  },
  {
    groupId: "l9-armoring",
    layerId: "layer_09_hardening",
    label: "Броня",
    imageUrl: defenseAssetImage.passiveItzBundle,
    previewImageUrl: defenseAssetPreview.passiveItzBundle,
  },
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
    previewImageUrl: asset.previewImageUrl,
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
    previewImageUrl: asset.previewImageUrl,
    isPlaceholder: Boolean(asset.isPlaceholder),
  };
}
