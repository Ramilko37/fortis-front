import type { DefensePriority } from "@/shared/types/defense-configuration";

export type Coordinates = {
  lat: number;
  lng: number;
  altitude?: number;
};

export type LayerGeometryType = "circle" | "ring" | "polygon" | "freeform";

export type LayerGeometry =
  | { type: "circle"; center: Coordinates; radiusM: number }
  | { type: "ring"; center: Coordinates; minRadiusM: number; maxRadiusM: number }
  | { type: "polygon" | "freeform"; points: Coordinates[] };

export type EditableDefenseLayer = {
  id: string;
  name: string;
  code: string;
  description?: string;
  order: number;
  distanceFromObjectMin?: number;
  distanceFromObjectMax?: number;
  geometryType: LayerGeometryType;
  geometry: LayerGeometry;
  color?: string;
  opacity?: number;
  isActive: boolean;
  isVisible?: boolean;
  isLocked?: boolean;
};

export type DefenseAssetCategory =
  | "early-warning"
  | "detection"
  | "classification"
  | "jamming"
  | "spoofing"
  | "kinetic"
  | "interceptor"
  | "passive-protection"
  | "engineering-protection"
  | "infrastructure"
  | "software"
  | "command-center"
  | "external-service";

export type DefenseAssetRole =
  | "detect"
  | "track"
  | "classify"
  | "suppress"
  | "destroy"
  | "delay"
  | "protect"
  | "coordinate"
  | "monitor"
  | "alert";

export type LayerType = LayerGeometryType;

export type DefenseAssetCoverageType = "circle" | "sector" | "line" | "polygon" | "none";

export type DefenseAsset = {
  id: string;
  name: string;
  shortName?: string;
  description?: string;
  category: DefenseAssetCategory;
  roles: DefenseAssetRole[];
  pricePerUnitMln: number | null;
  currency: "RUB";
  unitLabel: string;
  compatibleLayerTypes?: LayerType[];
  recommendedLayerCodes?: string[];
  compatibleLayerCodes?: string[];
  incompatibleLayerCodes?: string[];
  minEffectiveDistance?: number;
  maxEffectiveDistance?: number;
  coverageType: DefenseAssetCoverageType;
  coverageRadius?: number;
  coverageAngle?: number;
  deploymentType: "static" | "mobile" | "infrastructure" | "software" | "external";
  placementType: "map-object" | "zone-object" | "non-physical";
  iconUrl?: string;
  modelUrl?: string;
  score?: number;
  priority?: DefensePriority;
  tags?: string[];
  legacyItemId?: string;
  calculatorAssetId?: string | null;
  mapCatalogGroupIds?: string[];
};

export type DefenseAssetLibraryItem = DefenseAsset;

export type PlacedDefenseObject = {
  id: string;
  assetId: string;
  layerId: string;
  name?: string;
  coordinates: Coordinates;
  rotation?: number;
  scale?: number;
  quantity: number;
  status: "planned" | "active" | "inactive" | "maintenance";
  customPricePerUnitMln?: number;
  customCoverageRadius?: number;
  customCoverageAngle?: number;
  hasGeometryConflict?: boolean;
  hasCoverageConflict?: boolean;
  hasTerrainConflict?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProtectedObject = {
  id: string;
  name: string;
  center: Coordinates;
};

export type DefenseProjectMode = "view" | "edit-layers" | "place-object" | "move-object" | "measure";

export type DefenseProject = {
  schemaVersion: 1;
  projectId: string;
  projectName: string;
  baseObject: ProtectedObject;
  layers: EditableDefenseLayer[];
  assetLibrary: DefenseAsset[];
  placedObjects: PlacedDefenseObject[];
  activeLayerId?: string;
  selectedAssetId?: string;
  selectedObjectId?: string;
  mode: DefenseProjectMode;
  source?: "custom" | "preset" | "legacy-migration";
  basePresetId?: string;
  updatedAt: string;
};

export type PlacementValidationResult = {
  isValid: boolean;
  level: "success" | "warning" | "error";
  message?: string;
};

export type ProjectCalculatorLine = {
  assetId: string;
  quantity: number;
};

export type ProjectCalculatorConfiguration = {
  id: string;
  name: string;
  lines: ProjectCalculatorLine[];
};

export type LayerCost = {
  layerId: string;
  layerName: string;
  totalMln: number;
};

export type LayerSummary = LayerCost & {
  layerCode: string;
  objectCount: number;
  unitCount: number;
  coverageScore: number;
  conflictCount: number;
  innerRadiusM: number;
  widthM: number;
  outerRadiusM: number;
};

export type DeleteLayerResult =
  | { ok: true; project: DefenseProject }
  | { ok: false; reason: "layer-not-found" | "layer-has-objects" | "layer-locked" | "last-layer"; message: string };
