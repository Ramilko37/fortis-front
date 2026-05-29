export type LegacyObjectKind = "sensor" | "camera" | "shield" | "post" | "barrier";
export type ProtectiveObjectKind =
  | "operator_substation"
  | "scaffolding"
  | "fbs_enclosure"
  | "perimeter_barrier"
  | "cable_mesh";

export type ObjectKind = LegacyObjectKind | ProtectiveObjectKind;
export type ScenarioId = "baseline" | "balanced" | "reinforced";
export type DefenseRole = "command" | "scaffold" | "enclosure" | "barrier" | "mesh";
export type CriticalTargetType = "storage" | "command" | "power" | "process" | "reactor";
export type ThreatStatus = "detected" | "tracking" | "neutralized" | "breach";
export type ThreatOutcome = "neutralized" | "breach";
export type CameraPresetId = "overview" | "perimeter" | "tanks" | "operator";
export type DefenseLayerId =
  | "layer_01_external_warning"
  | "layer_02_detection"
  | "layer_03_identification"
  | "layer_04_suppression"
  | "layer_05_mid_range_kinetic"
  | "layer_06_last_line_kinetic"
  | "layer_07_accuracy_disruption"
  | "layer_08_passive_protection"
  | "layer_09_hardening";
export type DefenseLayerStatus = "covered" | "partial" | "weak" | "not_covered" | "missing_data";

export type SceneObject = {
  id: string;
  kind: ObjectKind;
  label: string;
  position: [number, number, number];
  radius: number;
  coverageRadiusM: number;
  elevation: number;
  zones: number;
  assignment: string;
  defenseRole: DefenseRole;
  costMln: number;
  effectiveness: number;
};

export type DefenseStats = {
  protectedObjects: number;
  protectedObjectsTotal: number;
  perimeterCoveredPercent: number;
  attacksRepelled: number;
  attacksTotal: number;
  residualRiskPercent: number;
  capexMln: number;
};

export type CriticalTarget = {
  id: string;
  label: string;
  position: [number, number, number];
  riskWeight: number;
  type: CriticalTargetType;
};

export type ThreatTrack = {
  id: string;
  label: string;
  targetId: CriticalTarget["id"];
  from: [number, number, number];
  to: [number, number, number];
  altitude: number;
  speed: number;
  detectAt: number;
  trackAt: number;
  neutralizeAt: number;
  outcomeByScenario: Record<ScenarioId, ThreatOutcome>;
};

export type AssetCatalogItem = {
  kind: ProtectiveObjectKind | "facility";
  label: string;
  tone: string;
};

export type DefenseLayer = {
  id: DefenseLayerId;
  number: number;
  sourceLayerIndex: number;
  sourceLayerCode: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  visualRole: string;
  coverageType: string;
  defaultWeight: number;
  zoneOfAction: string | null;
  readinessPctFromDashboard: number | null;
  readinessNote: string | null;
  statusFromDashboard: DefenseLayerStatus;
  assetIds: string[];
  assetCount: number;
};

export type DefenseAsset = {
  id: string;
  name: string;
  source: {
    workbook: string;
    sheet: string;
    excelRow: number;
    sourceLayerCode: string;
    sourceLayerName: string | null;
  };
  category: string;
  defenseLayerIds: DefenseLayerId[];
  layerNumber: number;
  sourceLayerIndex: number;
  typeOriginal: string | null;
  supplyChannelScore: number | null;
  localizationScore: number | null;
  quantityOnSite: number | null;
  score1to10: number | null;
  derived: {
    availabilityScoreDraft: number | null;
    effectiveness: number | null;
    costCapexMlnRub: number | null;
    costOpexMlnRubYear: number | null;
  };
  coverage: {
    type: string;
    zoneOfAction: string | null;
    radiusM: number | null;
    widthM: number | null;
    heightM: number | null;
    lengthM: number | null;
  };
  threatTypes: string[];
  status: string;
  visualization: {
    modelUrl: string | null;
    icon: string | null;
    color: string | null;
  };
  description: string | null;
};

export type DefenseCatalogData = {
  schemaVersion: string;
  generatedFrom: {
    sourceWorkbook: string;
    sourceSheets: string[];
    normalizationRule: string;
  };
  summary: {
    totalAssets: number;
    totalLayers: number;
    assetsByLayer: Record<DefenseLayerId, number>;
    layersCoveredOrPartialByDashboard: number;
    layersWithMissingDashboardReadiness: DefenseLayerId[];
  };
  criteriaWeightsFromExcel: {
    typeWeightPct: number | null;
    supplyChannelWeightPct: number | null;
    localizationWeightPct: number | null;
    quantityOnSiteWeightPct: number | null;
    score1to10WeightPct: number | null;
  };
  defenseLayers: DefenseLayer[];
  defenseAssets: DefenseAsset[];
  effectivenessMatrix: {
    status?: string;
    note?: string;
  };
};

export const scenarioLabels: Record<ScenarioId, string> = {
  baseline: "Baseline",
  balanced: "Balanced",
  reinforced: "Reinforced",
};

export const kindLabel: Record<ObjectKind, string> = {
  operator_substation: "Операторная / подстанция",
  scaffolding: "Защитные строительные леса",
  fbs_enclosure: "ФБС-защита",
  perimeter_barrier: "Периметральная ФБС-линия",
  cable_mesh: "Сеточная тросовая завеса",

  sensor: "Сенсорная мачта",
  camera: "Камера",
  shield: "Защитный купол",
  post: "Пост управления",
  barrier: "Барьер",
};

export const defenseRoleLabel: Record<DefenseRole, string> = {
  command: "Командный узел",
  scaffold: "Защита оборудования",
  enclosure: "Локальное укрытие",
  barrier: "Периметр",
  mesh: "Сеточная завеса",
};

export const defenseRoleColor: Record<DefenseRole, string> = {
  command: "#55d6ff",
  scaffold: "#67e8a6",
  enclosure: "#f4c860",
  barrier: "#ff9b63",
  mesh: "#c5d6e5",
};

export const kindColor: Record<ObjectKind, string> = {
  operator_substation: defenseRoleColor.command,
  scaffolding: defenseRoleColor.scaffold,
  fbs_enclosure: defenseRoleColor.enclosure,
  perimeter_barrier: defenseRoleColor.barrier,
  cable_mesh: defenseRoleColor.mesh,

  sensor: "#4cc8ff",
  camera: "#5cc7f5",
  shield: "#f4c24e",
  post: "#9cc9e5",
  barrier: "#d8b16c",
};

export const threatStatusLabel: Record<ThreatStatus, string> = {
  detected: "Обнаружен",
  tracking: "Сопровождение",
  neutralized: "Нейтрализован",
  breach: "Прорыв",
};

export const threatStatusColor: Record<ThreatStatus, string> = {
  detected: "#70c9ff",
  tracking: "#f5ce6a",
  neutralized: "#67e8a6",
  breach: "#ff6b5f",
};

export const defenseLayerStatusLabel: Record<DefenseLayerStatus, string> = {
  covered: "Закрыт",
  partial: "Частично",
  weak: "Слабый",
  not_covered: "Не закрыт",
  missing_data: "Нет данных",
};

export const defenseLayerStatusColor: Record<DefenseLayerStatus, string> = {
  covered: "#27b16d",
  partial: "#d8a31c",
  weak: "#d97a2b",
  not_covered: "#d14b4b",
  missing_data: "#8a94a5",
};

export const assetCatalog: AssetCatalogItem[] = [
  { kind: "operator_substation", label: "Операторная / подстанция", tone: "cyan" },
  { kind: "scaffolding", label: "Защитные леса", tone: "green" },
  { kind: "fbs_enclosure", label: "ФБС-защита", tone: "amber" },
  { kind: "perimeter_barrier", label: "Периметральный барьер", tone: "orange" },
  { kind: "cable_mesh", label: "Сеточная завеса", tone: "steel" },
];

export const objectDefaultsByKind: Record<
  ObjectKind,
  Pick<SceneObject, "coverageRadiusM" | "elevation" | "zones" | "defenseRole" | "costMln" | "effectiveness">
> = {
  operator_substation: {
    coverageRadiusM: 140,
    elevation: 12,
    zones: 2,
    defenseRole: "command",
    costMln: 38,
    effectiveness: 0.78,
  },
  scaffolding: {
    coverageRadiusM: 125,
    elevation: 10,
    zones: 1,
    defenseRole: "scaffold",
    costMln: 24,
    effectiveness: 0.72,
  },
  fbs_enclosure: {
    coverageRadiusM: 115,
    elevation: 9,
    zones: 1,
    defenseRole: "enclosure",
    costMln: 28,
    effectiveness: 0.66,
  },
  perimeter_barrier: {
    coverageRadiusM: 120,
    elevation: 8,
    zones: 2,
    defenseRole: "barrier",
    costMln: 22,
    effectiveness: 0.7,
  },
  cable_mesh: {
    coverageRadiusM: 105,
    elevation: 10,
    zones: 1,
    defenseRole: "mesh",
    costMln: 16,
    effectiveness: 0.62,
  },
  sensor: {
    coverageRadiusM: 120,
    elevation: 14,
    zones: 2,
    defenseRole: "command",
    costMln: 20,
    effectiveness: 0.64,
  },
  camera: {
    coverageRadiusM: 90,
    elevation: 12,
    zones: 1,
    defenseRole: "mesh",
    costMln: 12,
    effectiveness: 0.52,
  },
  shield: {
    coverageRadiusM: 110,
    elevation: 9,
    zones: 1,
    defenseRole: "enclosure",
    costMln: 18,
    effectiveness: 0.58,
  },
  post: {
    coverageRadiusM: 100,
    elevation: 8,
    zones: 1,
    defenseRole: "barrier",
    costMln: 16,
    effectiveness: 0.55,
  },
  barrier: {
    coverageRadiusM: 105,
    elevation: 8,
    zones: 1,
    defenseRole: "barrier",
    costMln: 14,
    effectiveness: 0.52,
  },
};

function createScenarioObject(
  id: string,
  kind: ProtectiveObjectKind,
  label: string,
  position: [number, number, number],
  overrides: Partial<Pick<SceneObject, "coverageRadiusM" | "elevation" | "zones" | "defenseRole" | "costMln" | "effectiveness" | "assignment">> = {},
): SceneObject {
  const defaults = objectDefaultsByKind[kind];
  return {
    id,
    kind,
    label,
    position,
    radius: overrides.coverageRadiusM ?? defaults.coverageRadiusM,
    coverageRadiusM: overrides.coverageRadiusM ?? defaults.coverageRadiusM,
    elevation: overrides.elevation ?? defaults.elevation,
    zones: overrides.zones ?? defaults.zones,
    assignment: overrides.assignment ?? "Сетка Альфа",
    defenseRole: overrides.defenseRole ?? defaults.defenseRole,
    costMln: overrides.costMln ?? defaults.costMln,
    effectiveness: overrides.effectiveness ?? defaults.effectiveness,
  };
}

const baselineScenario: SceneObject[] = [
  createScenarioObject("baseline-command-operator", "operator_substation", "Операторная / подстанция 01", [-18, 0, 220], {
    costMln: 38,
  }),
  createScenarioObject("baseline-tank-fbs", "fbs_enclosure", "ФБС-защита резервуарного парка", [174, 0, 174], {
    costMln: 28,
  }),
  createScenarioObject("baseline-reactor-scaffold", "scaffolding", "Защитные леса реакторного блока", [10, 0, 176], {
    costMln: 24,
  }),
  createScenarioObject("baseline-south-barrier", "perimeter_barrier", "ФБС-линия южного периметра", [52, 0, 75], {
    costMln: 20,
  }),
  createScenarioObject("baseline-substation-mesh", "cable_mesh", "Сетка у подстанции", [-55, 0, 272], {
    costMln: 16,
  }),
  createScenarioObject("baseline-west-fbs", "fbs_enclosure", "ФБС-защита западной емкостной зоны", [-71, 0, -201], {
    costMln: 24,
  }),
  createScenarioObject("baseline-west-scaffold", "scaffolding", "Защитные леса колонных аппаратов", [-235, 0, -199], {
    costMln: 22,
  }),
  createScenarioObject("baseline-east-barrier", "perimeter_barrier", "ФБС-линия восточного въезда", [297, 0, -300], {
    costMln: 22,
  }),
];

const perimeterAdditions: SceneObject[] = [
  createScenarioObject("perimeter-storage-fbs", "fbs_enclosure", "ФБС-контур склада сырья", [148, 0, 156], {
    costMln: 25,
    coverageRadiusM: 125,
  }),
  createScenarioObject("perimeter-north-mesh", "cable_mesh", "Северная тросовая завеса", [35, 0, 254], {
    costMln: 16,
    coverageRadiusM: 115,
  }),
  createScenarioObject("perimeter-east-mesh", "cable_mesh", "Восточная сеточная завеса", [190, 0, -103], {
    costMln: 17,
    coverageRadiusM: 120,
  }),
  createScenarioObject("perimeter-west-barrier", "perimeter_barrier", "Западная ФБС-линия", [-193, 0, -300], {
    costMln: 22,
    coverageRadiusM: 130,
  }),
  createScenarioObject("perimeter-east-storage-barrier", "perimeter_barrier", "ФБС-линия восточного склада", [393, 0, -219], {
    costMln: 24,
    coverageRadiusM: 130,
  }),
  createScenarioObject("perimeter-operator-mesh", "cable_mesh", "Тыловая сетка операторной", [-210, 0, -121], {
    costMln: 22,
    coverageRadiusM: 120,
  }),
];

export const scenarioPresets: Record<ScenarioId, SceneObject[]> = {
  baseline: baselineScenario,
  balanced: [
    ...baselineScenario,
    createScenarioObject("balanced-ew-mesh", "cable_mesh", "РЭБ / сеточная зона L4-L7", [35, 0, 254], {
      costMln: 31,
      coverageRadiusM: 120,
    }),
  ],
  reinforced: [...baselineScenario, ...perimeterAdditions],
};

export const scenarioStats: Record<ScenarioId, DefenseStats> = {
  baseline: {
    protectedObjects: 5,
    protectedObjectsTotal: 7,
    perimeterCoveredPercent: 54,
    attacksRepelled: 4,
    attacksTotal: 6,
    residualRiskPercent: 34,
    capexMln: 194,
  },
  balanced: {
    protectedObjects: 6,
    protectedObjectsTotal: 7,
    perimeterCoveredPercent: 68,
    attacksRepelled: 5,
    attacksTotal: 6,
    residualRiskPercent: 24,
    capexMln: 225,
  },
  reinforced: {
    protectedObjects: 7,
    protectedObjectsTotal: 7,
    perimeterCoveredPercent: 82,
    attacksRepelled: 6,
    attacksTotal: 6,
    residualRiskPercent: 12,
    capexMln: 320,
  },
};

export const criticalTargets: CriticalTarget[] = [
  { id: "reservoir-park", label: "Резервуарный парк", position: [174, 0, 132], riskWeight: 1, type: "storage" },
  { id: "operator-station", label: "Операторная", position: [-18, 0, 220], riskWeight: 0.9, type: "command" },
  { id: "power-substation", label: "Подстанция", position: [-150, 0, 294], riskWeight: 0.78, type: "power" },
  { id: "column-unit", label: "Колонные аппараты", position: [-5, 0, 113], riskWeight: 0.86, type: "process" },
  { id: "reactor-block", label: "Реакторный блок", position: [88, 0, 170], riskWeight: 0.95, type: "reactor" },
  { id: "west-tanks", label: "Западные емкости", position: [-73, 0, -243], riskWeight: 0.76, type: "storage" },
  { id: "east-storage", label: "Восточный склад", position: [417, 0, -243], riskWeight: 0.72, type: "storage" },
];

export const threatTracks: ThreatTrack[] = [
  {
    id: "threat-01",
    label: "Курс 01",
    targetId: "operator-station",
    from: [-420, 32, 320],
    to: [-18, 32, 220],
    altitude: 32,
    speed: 0.095,
    detectAt: 0.18,
    trackAt: 0.42,
    neutralizeAt: 0.66,
    outcomeByScenario: { baseline: "neutralized", balanced: "neutralized", reinforced: "neutralized" },
  },
  {
    id: "threat-02",
    label: "Курс 02",
    targetId: "reservoir-park",
    from: [360, 36, 360],
    to: [174, 36, 132],
    altitude: 36,
    speed: 0.088,
    detectAt: 0.2,
    trackAt: 0.45,
    neutralizeAt: 0.7,
    outcomeByScenario: { baseline: "neutralized", balanced: "neutralized", reinforced: "neutralized" },
  },
  {
    id: "threat-03",
    label: "Курс 03",
    targetId: "column-unit",
    from: [-480, 30, -220],
    to: [-5, 30, 113],
    altitude: 30,
    speed: 0.083,
    detectAt: 0.16,
    trackAt: 0.4,
    neutralizeAt: 0.68,
    outcomeByScenario: { baseline: "neutralized", balanced: "neutralized", reinforced: "neutralized" },
  },
  {
    id: "threat-04",
    label: "Курс 04",
    targetId: "reactor-block",
    from: [560, 34, -360],
    to: [88, 34, 170],
    altitude: 34,
    speed: 0.078,
    detectAt: 0.22,
    trackAt: 0.48,
    neutralizeAt: 0.74,
    outcomeByScenario: { baseline: "breach", balanced: "neutralized", reinforced: "neutralized" },
  },
  {
    id: "threat-05",
    label: "Курс 05",
    targetId: "power-substation",
    from: [-560, 31, 40],
    to: [-150, 31, 294],
    altitude: 31,
    speed: 0.09,
    detectAt: 0.18,
    trackAt: 0.44,
    neutralizeAt: 0.69,
    outcomeByScenario: { baseline: "neutralized", balanced: "neutralized", reinforced: "neutralized" },
  },
  {
    id: "threat-06",
    label: "Курс 06",
    targetId: "east-storage",
    from: [560, 36, 20],
    to: [417, 36, -243],
    altitude: 36,
    speed: 0.086,
    detectAt: 0.24,
    trackAt: 0.5,
    neutralizeAt: 0.76,
    outcomeByScenario: { baseline: "breach", balanced: "breach", reinforced: "neutralized" },
  },
];

export function cloneScenario(id: ScenarioId) {
  return scenarioPresets[id].map((item) => ({ ...item, position: [...item.position] as [number, number, number] }));
}

export function snapToGrid(value: number, step = 0.5) {
  return Math.round(value / step) * step;
}

export function getLayerStatus(readinessPct: number | null): DefenseLayerStatus {
  if (readinessPct === null) return "missing_data";
  if (readinessPct >= 75) return "covered";
  if (readinessPct >= 40) return "partial";
  if (readinessPct > 0) return "weak";
  return "not_covered";
}
