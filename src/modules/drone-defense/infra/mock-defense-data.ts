import type {
  Configuration,
  DefenseAsset,
  DefenseCatalogResponse,
  DefenseLayer,
  DefenseLayerId,
  DefenseScenarioId,
  Facility,
  HexCell,
  Placement,
  ThreatRoute,
  ThreatType,
  ThreatTypeId,
} from "@/shared/types/drone-defense";

export const defenseLayers: DefenseLayer[] = [
  { id: "layer_01_external_warning", order: 1, name: "Внешнее предупреждение", shortName: "L1", defaultWeight: 0.08, distanceBandM: { min: 60000, max: 120000, label: "60-120 км" } },
  { id: "layer_02_detection", order: 2, name: "Обнаружение", shortName: "L2", defaultWeight: 0.12, distanceBandM: { min: 30000, max: 60000, label: "30-60 км" } },
  { id: "layer_03_identification", order: 3, name: "Идентификация", shortName: "L3", defaultWeight: 0.1, distanceBandM: { min: 15000, max: 30000, label: "15-30 км" } },
  { id: "layer_04_suppression", order: 4, name: "Подавление", shortName: "L4", defaultWeight: 0.15, distanceBandM: { min: 8000, max: 15000, label: "8-15 км" } },
  { id: "layer_05_mid_range_kinetic", order: 5, name: "Средний рубеж", shortName: "L5", defaultWeight: 0.13, distanceBandM: { min: 4000, max: 8000, label: "4-8 км" } },
  { id: "layer_06_last_line_kinetic", order: 6, name: "Последний рубеж", shortName: "L6", defaultWeight: 0.12, distanceBandM: { min: 1500, max: 4000, label: "1.5-4 км" } },
  { id: "layer_07_accuracy_disruption", order: 7, name: "Срыв точности", shortName: "L7", defaultWeight: 0.1, distanceBandM: { min: 500, max: 1500, label: "0.5-1.5 км" } },
  { id: "layer_08_passive_protection", order: 8, name: "Пассивная защита", shortName: "L8", defaultWeight: 0.1, distanceBandM: { min: 100, max: 500, label: "100-500 м" } },
  { id: "layer_09_hardening", order: 9, name: "Hardening", shortName: "L9", defaultWeight: 0.1, distanceBandM: { min: 0, max: 100, label: "0-100 м" } },
];

export type EchelonCatalogGroup = {
  id: string;
  layerId: DefenseLayerId;
  name: string;
  assetTemplateId: DefenseAsset["id"];
  weightPct: number;
};

export const echelonCatalogGroups: EchelonCatalogGroup[] = [
  { id: "l1-emergency-centers", layerId: "layer_01_external_warning", name: "Региональные центры МЧС", assetTemplateId: "asset-radar-l2", weightPct: 18 },
  { id: "l1-military-command", layerId: "layer_01_external_warning", name: "Военная комендатура", assetTemplateId: "asset-radar-l2", weightPct: 16 },
  { id: "l1-regional-hq", layerId: "layer_01_external_warning", name: "Оперативный штаб региона / ФСБ-куратор", assetTemplateId: "asset-radar-l2", weightPct: 22 },
  { id: "l1-neighbor-network", layerId: "layer_01_external_warning", name: "Сетка соседних предприятий", assetTemplateId: "asset-radar-l2", weightPct: 14 },
  { id: "l1-osint", layerId: "layer_01_external_warning", name: "OSINT-мониторинг", assetTemplateId: "asset-radar-l2", weightPct: 12 },
  { id: "l2-radar", layerId: "layer_02_detection", name: "РЛС", assetTemplateId: "asset-radar-l2", weightPct: 24 },
  { id: "l2-optical", layerId: "layer_02_detection", name: "Оптико-электронные системы", assetTemplateId: "asset-radar-l2", weightPct: 18 },
  { id: "l2-thermal", layerId: "layer_02_detection", name: "Тепловизионные системы", assetTemplateId: "asset-radar-l2", weightPct: 16 },
  { id: "l2-acoustic", layerId: "layer_02_detection", name: "Акустические массивы", assetTemplateId: "asset-radar-l2", weightPct: 14 },
  { id: "l2-rf-passive", layerId: "layer_02_detection", name: "Пассивные радиочастотные детекторы", assetTemplateId: "asset-radar-l2", weightPct: 16 },
  { id: "l3-classification", layerId: "layer_03_identification", name: "ПО классификации целей", assetTemplateId: "asset-radar-l2", weightPct: 20 },
  { id: "l4-ew-gnss", layerId: "layer_04_suppression", name: "РЭБ узкополосный против GNSS", assetTemplateId: "asset-ew-l4", weightPct: 20 },
  { id: "l4-ew-radio", layerId: "layer_04_suppression", name: "РЭБ широкополосный против радиоканалов", assetTemplateId: "asset-ew-l4", weightPct: 22 },
  { id: "l4-gps-spoof", layerId: "layer_04_suppression", name: "GPS-спуферы", assetTemplateId: "asset-ew-l4", weightPct: 16 },
  { id: "l4-microwave", layerId: "layer_04_suppression", name: "СВЧ-оружие", assetTemplateId: "asset-ew-l4", weightPct: 18 },
  { id: "l4-laser", layerId: "layer_04_suppression", name: "Лазерные системы", assetTemplateId: "asset-ew-l4", weightPct: 16 },
  { id: "l5-mobile-fire", layerId: "layer_05_mid_range_kinetic", name: "МОГ", assetTemplateId: "asset-kinetic-l6", weightPct: 15 },
  { id: "l5-bars", layerId: "layer_05_mid_range_kinetic", name: "БАРС", assetTemplateId: "asset-kinetic-l6", weightPct: 16 },
  { id: "l5-interceptor", layerId: "layer_05_mid_range_kinetic", name: "Дроны-перехватчики", assetTemplateId: "asset-kinetic-l6", weightPct: 20 },
  { id: "l5-turret", layerId: "layer_05_mid_range_kinetic", name: "Турельные стрелковые комплексы", assetTemplateId: "asset-kinetic-l6", weightPct: 18 },
  { id: "l6-zrpk", layerId: "layer_06_last_line_kinetic", name: "ЗРПК", assetTemplateId: "asset-kinetic-l6", weightPct: 20 },
  { id: "l6-pzrk", layerId: "layer_06_last_line_kinetic", name: "ПЗРК", assetTemplateId: "asset-kinetic-l6", weightPct: 18 },
  { id: "l6-barrel", layerId: "layer_06_last_line_kinetic", name: "Ствольная ПВО", assetTemplateId: "asset-kinetic-l6", weightPct: 18 },
  { id: "l7-camouflage", layerId: "layer_07_accuracy_disruption", name: "Маскировочные сети и экраны", assetTemplateId: "asset-ew-l4", weightPct: 16 },
  { id: "l7-smoke", layerId: "layer_07_accuracy_disruption", name: "Дымогенерация", assetTemplateId: "asset-ew-l4", weightPct: 12 },
  { id: "l7-thermal-decoy", layerId: "layer_07_accuracy_disruption", name: "Ложные тепловые сигнатуры", assetTemplateId: "asset-ew-l4", weightPct: 14 },
  { id: "l7-decoys", layerId: "layer_07_accuracy_disruption", name: "Макеты-обманки", assetTemplateId: "asset-ew-l4", weightPct: 12 },
  { id: "l7-contrast", layerId: "layer_07_accuracy_disruption", name: "Снижение оптического и ИК-контраста", assetTemplateId: "asset-ew-l4", weightPct: 14 },
  { id: "l8-anti-drone-nets", layerId: "layer_08_passive_protection", name: "Антидроновые сетки", assetTemplateId: "asset-passive-l8", weightPct: 20 },
  { id: "l8-cable-systems", layerId: "layer_08_passive_protection", name: "Тросовые системы", assetTemplateId: "asset-passive-l8", weightPct: 18 },
  { id: "l8-domes", layerId: "layer_08_passive_protection", name: "Купола и аэростаты", assetTemplateId: "asset-passive-l8", weightPct: 16 },
  { id: "l9-spacing", layerId: "layer_09_hardening", name: "Инженерное разнесение / дублирование", assetTemplateId: "asset-hardening-l9", weightPct: 18 },
  { id: "l9-armoring", layerId: "layer_09_hardening", name: "Усиленные конструкции / бронирование критических узлов", assetTemplateId: "asset-hardening-l9", weightPct: 22 },
];

export function getCatalogGroupsForLayer(layerId: DefenseLayerId) {
  return echelonCatalogGroups.filter((group) => group.layerId === layerId);
}

export function buildCatalogPlacement({
  facilityId,
  scenarioId,
  groupId,
  slotId,
  mapRef,
}: {
  facilityId: string;
  scenarioId: DefenseScenarioId;
  groupId: string;
  slotId?: string;
  mapRef?: { lon: number; lat: number };
}): Placement {
  const group = echelonCatalogGroups.find((item) => item.id === groupId);
  if (!group) {
    throw new Error(`Unknown echelon catalog group: ${groupId}`);
  }

  const layer = defenseLayers.find((item) => item.id === group.layerId);
  const layerGapBoost = 1 + group.weightPct / 100;

  return {
    id: `${facilityId}-${scenarioId}-${group.id}${slotId ? `-${slotId}` : ""}`,
    assetId: group.assetTemplateId,
    facilityId,
    scenarioId,
    layerId: group.layerId,
    catalogGroupId: group.id,
    catalogGroupName: group.name,
    slotId,
    mapRef,
    qty: 1,
    readiness: 0.72,
    layerGapBoost,
    criticalityBoost: layer ? 1 + layer.defaultWeight : 1.05,
    feasibility: 0.82,
    environmentModifier: 0.92,
  };
}

export function measureGeoDistanceM(from: { lon: number; lat: number }, to: { lon: number; lat: number }) {
  const latMeters = (to.lat - from.lat) * 111_320;
  const lonMeters = (to.lon - from.lon) * 111_320 * Math.cos(((from.lat + to.lat) / 2) * (Math.PI / 180));
  return Math.hypot(latMeters, lonMeters);
}

export function getLayerDistanceFit(layer: DefenseLayer, distanceM: number) {
  const { min, max } = layer.distanceBandM;
  if (distanceM >= min && distanceM <= max) return 1;
  const toleranceM = Math.max(100, (max - min) * 0.5);
  const distanceToBand = distanceM < min ? min - distanceM : distanceM - max;
  return Math.max(0, 1 - distanceToBand / toleranceM);
}

export const scenarioOptions: Array<{ id: DefenseScenarioId; label: string; summary: string }> = [
  { id: "baseline", label: "Baseline", summary: "Минимально необходимый контур" },
  { id: "balanced", label: "Balanced", summary: "Оптимальный баланс риска и стоимости" },
  { id: "reinforced", label: "Reinforced", summary: "Максимальное закрытие эшелонов" },
];

export const threatTypes: ThreatType[] = [
  { id: "fixedWing", label: "Fixed-wing", weight: 1, color: "#ff6f61" },
  { id: "fpv", label: "FPV", weight: 0.9, color: "#ffc857" },
  { id: "loitering", label: "Loitering", weight: 0.95, color: "#59cd90" },
  { id: "swarm", label: "Swarm", weight: 1.1, color: "#00a6fb" },
];

export const facilities: Facility[] = [
  {
    id: "facility-alpha",
    name: "Завод Альфа",
    region: "Свердловская область",
    center: { lon: 60.5945, lat: 56.8389 },
    priorityWeight: 1,
    status: "active",
  },
  {
    id: "facility-beta",
    name: "Резервуарный парк Бета",
    region: "Свердловская область",
    center: { lon: 60.5112, lat: 56.9212 },
    priorityWeight: 0.9,
    status: "configuring",
  },
  {
    id: "facility-gamma",
    name: "Промышленный узел Гамма",
    region: "Пермский край",
    center: { lon: 56.2502, lat: 58.0105 },
    priorityWeight: 0.82,
    status: "offline",
  },
];

function squareHex(id: string, centerLon: number, centerLat: number, size = 0.06) {
  return {
    id,
    scheme: "h3" as const,
    resolution: 7,
    center: { lon: centerLon, lat: centerLat },
    polygon: [
      { lon: centerLon - size, lat: centerLat },
      { lon: centerLon - size / 2, lat: centerLat + size * 0.88 },
      { lon: centerLon + size / 2, lat: centerLat + size * 0.88 },
      { lon: centerLon + size, lat: centerLat },
      { lon: centerLon + size / 2, lat: centerLat - size * 0.88 },
      { lon: centerLon - size / 2, lat: centerLat - size * 0.88 },
      { lon: centerLon - size, lat: centerLat },
    ],
  };
}

export const hexCells: HexCell[] = [
  {
    ...squareHex("871f1d489ffffff", 60.5945, 56.8389),
    facilityId: "facility-alpha",
    priorityWeight: 1,
    baseRisk: { fixedWing: 0.62, fpv: 0.58, loitering: 0.54, swarm: 0.66 },
  },
  {
    ...squareHex("871f1d48affffff", 60.641, 56.862),
    facilityId: "facility-alpha",
    priorityWeight: 0.92,
    baseRisk: { fixedWing: 0.55, fpv: 0.44, loitering: 0.5, swarm: 0.57 },
  },
  {
    ...squareHex("871f1cb8dffffff", 60.5112, 56.9212),
    facilityId: "facility-beta",
    priorityWeight: 0.9,
    baseRisk: { fixedWing: 0.5, fpv: 0.63, loitering: 0.52, swarm: 0.6 },
  },
  {
    ...squareHex("871f1cb87ffffff", 56.2502, 58.0105),
    facilityId: "facility-gamma",
    priorityWeight: 0.82,
    baseRisk: { fixedWing: 0.48, fpv: 0.42, loitering: 0.45, swarm: 0.54 },
  },
];

export const threatRoutes: ThreatRoute[] = [
  {
    id: "route-001",
    facilityId: "facility-alpha",
    threatType: "fixedWing",
    probability: 0.35,
    path: [
      { lon: 60.33, lat: 56.95 },
      { lon: 60.46, lat: 56.89 },
      { lon: 60.5945, lat: 56.8389 },
    ],
  },
  {
    id: "route-002",
    facilityId: "facility-beta",
    threatType: "fpv",
    probability: 0.42,
    path: [
      { lon: 60.72, lat: 56.99 },
      { lon: 60.59, lat: 56.94 },
      { lon: 60.5112, lat: 56.9212 },
    ],
  },
  {
    id: "route-003",
    facilityId: "facility-gamma",
    threatType: "swarm",
    probability: 0.29,
    path: [
      { lon: 56.4, lat: 58.13 },
      { lon: 56.3, lat: 58.08 },
      { lon: 56.2502, lat: 58.0105 },
    ],
  },
];

export const defenseAssets: DefenseAsset[] = [
  {
    id: "asset-radar-l2",
    kind: "operator_substation",
    name: "РЛС дальнего обнаружения",
    layerIds: ["layer_02_detection"],
    placementMode: "anchor-or-sector",
    scope: "regional",
    coverageRadiusM: 45000,
    suitability: { effEnv: 0.82, availability: 0.68, governance: 0.74, deploySpeed: 0.6, costScore: 0.44 },
    threatCoefficients: { fixedWing: 0.85, fpv: 0.3, loitering: 0.58, swarm: 0.25 },
    cost: { capexRub: 42000000, opexRubYear: 6000000 },
  },
  {
    id: "asset-ew-l4",
    kind: "cable_mesh",
    name: "Комплекс РЭБ подавления",
    layerIds: ["layer_04_suppression", "layer_07_accuracy_disruption"],
    placementMode: "anchor-or-sector",
    scope: "regional",
    coverageRadiusM: 12000,
    suitability: { effEnv: 0.7, availability: 0.65, governance: 0.69, deploySpeed: 0.66, costScore: 0.57 },
    threatCoefficients: { fixedWing: 0.41, fpv: 0.77, loitering: 0.61, swarm: 0.72 },
    cost: { capexRub: 31000000, opexRubYear: 5400000 },
  },
  {
    id: "asset-kinetic-l6",
    kind: "perimeter_barrier",
    name: "Кинетический последний рубеж",
    layerIds: ["layer_06_last_line_kinetic"],
    placementMode: "anchor-or-sector",
    scope: "facility",
    coverageRadiusM: 4500,
    suitability: { effEnv: 0.78, availability: 0.6, governance: 0.67, deploySpeed: 0.55, costScore: 0.39 },
    threatCoefficients: { fixedWing: 0.55, fpv: 0.76, loitering: 0.72, swarm: 0.64 },
    cost: { capexRub: 52000000, opexRubYear: 9100000 },
  },
  {
    id: "asset-passive-l8",
    kind: "fbs_enclosure",
    name: "ФБС контур критических узлов",
    layerIds: ["layer_08_passive_protection", "layer_09_hardening"],
    placementMode: "site-point",
    scope: "facility",
    coverageRadiusM: 650,
    suitability: { effEnv: 0.73, availability: 0.74, governance: 0.77, deploySpeed: 0.58, costScore: 0.61 },
    threatCoefficients: { fixedWing: 0.48, fpv: 0.45, loitering: 0.52, swarm: 0.4 },
    cost: { capexRub: 18000000, opexRubYear: 2200000 },
  },
  {
    id: "asset-hardening-l9",
    kind: "scaffolding",
    name: "Hardening защитные леса",
    layerIds: ["layer_09_hardening"],
    placementMode: "site-point",
    scope: "facility",
    coverageRadiusM: 350,
    suitability: { effEnv: 0.66, availability: 0.72, governance: 0.75, deploySpeed: 0.62, costScore: 0.7 },
    threatCoefficients: { fixedWing: 0.36, fpv: 0.44, loitering: 0.41, swarm: 0.31 },
    cost: { capexRub: 9500000, opexRubYear: 1400000 },
  },
];

export const threatLayerMatrix: Record<ThreatTypeId, Record<DefenseLayerId, number>> = {
  fixedWing: {
    layer_01_external_warning: 0.45,
    layer_02_detection: 0.7,
    layer_03_identification: 0.55,
    layer_04_suppression: 0.4,
    layer_05_mid_range_kinetic: 0.55,
    layer_06_last_line_kinetic: 0.25,
    layer_07_accuracy_disruption: 0.2,
    layer_08_passive_protection: 0.15,
    layer_09_hardening: 0.2,
  },
  fpv: {
    layer_01_external_warning: 0.2,
    layer_02_detection: 0.4,
    layer_03_identification: 0.35,
    layer_04_suppression: 0.55,
    layer_05_mid_range_kinetic: 0.3,
    layer_06_last_line_kinetic: 0.5,
    layer_07_accuracy_disruption: 0.45,
    layer_08_passive_protection: 0.4,
    layer_09_hardening: 0.3,
  },
  loitering: {
    layer_01_external_warning: 0.35,
    layer_02_detection: 0.6,
    layer_03_identification: 0.5,
    layer_04_suppression: 0.45,
    layer_05_mid_range_kinetic: 0.45,
    layer_06_last_line_kinetic: 0.35,
    layer_07_accuracy_disruption: 0.3,
    layer_08_passive_protection: 0.25,
    layer_09_hardening: 0.35,
  },
  swarm: {
    layer_01_external_warning: 0.3,
    layer_02_detection: 0.55,
    layer_03_identification: 0.4,
    layer_04_suppression: 0.35,
    layer_05_mid_range_kinetic: 0.25,
    layer_06_last_line_kinetic: 0.3,
    layer_07_accuracy_disruption: 0.2,
    layer_08_passive_protection: 0.15,
    layer_09_hardening: 0.1,
  },
};

const scenarioAssetIds: Record<DefenseScenarioId, string[]> = {
  baseline: ["asset-radar-l2", "asset-passive-l8"],
  balanced: ["asset-radar-l2", "asset-ew-l4", "asset-passive-l8"],
  reinforced: ["asset-radar-l2", "asset-ew-l4", "asset-kinetic-l6", "asset-passive-l8", "asset-hardening-l9"],
};

export function buildScenarioConfiguration(
  facilityId: string,
  scenarioId: DefenseScenarioId,
  localPlacements: Placement[] = [],
): Configuration {
  const placements = scenarioAssetIds[scenarioId].map((assetId, index) => ({
    id: `${facilityId}-${scenarioId}-${assetId}-${index}`,
    assetId,
    facilityId,
    scenarioId,
    qty: 1,
    readiness: scenarioId === "reinforced" ? 0.78 : scenarioId === "balanced" ? 0.72 : 0.66,
    layerGapBoost: 1.04 + index * 0.02,
    criticalityBoost: 1.05,
    feasibility: 0.8,
    environmentModifier: 0.92,
  }));

  return { facilityId, scenarioId, placements: [...placements, ...localPlacements] };
}

export function buildCatalogResponse(): DefenseCatalogResponse {
  return {
    layers: defenseLayers,
    assets: defenseAssets,
    threatTypes,
    matrix: threatLayerMatrix,
  };
}
