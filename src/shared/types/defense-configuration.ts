import type { DefenseLayerId, DefenseScenarioId, Placement } from "@/shared/types/drone-defense";

export type DefenseConfigurationSource = "custom" | "preset";
export type DefensePriority = "primary" | "medium" | "low";

export type MogEquipmentId = "binoculars" | "nightVision" | "vehicle" | "searchlight" | "droneDetectors";

export type MogWeaponId = "firearms" | "antiDroneRifles" | "interceptorDrones";

export type MogEquipmentItem = {
  id: MogEquipmentId;
  label: string;
  quantity: string;
};

export type MogWeaponItem = {
  id: MogWeaponId;
  label: string;
  quantity: string;
  rangeM: number;
};

export type DefenseAssetCompoundProfile = {
  kind: "compound-post";
  postType: string;
  personnelCount: string;
  accountability: string;
  armament: string;
  weaponUnits: string;
  sectorOrRange: string;
  equipment?: MogEquipmentItem[];
  weapons?: MogWeaponItem[];
  coverageWeaponId?: MogWeaponId;
  sectorWidthDeg?: number;
};

export type PlacedDefenseCompoundProfile = DefenseAssetCompoundProfile & {
  azimuth: number;
};

export type DefenseItem = {
  id: string;
  title: string;
  shortTitle?: string;
  mapCatalogGroupIds: string[];
  mapAssetTemplateId?: string;
  calculatorAssetId?: string | null;
  layerId?: DefenseLayerId;
  echelonId?: string;
  rangeLabel?: string;
  unitLabel: string;
  pricePerUnitMln: number | null;
  currency: "RUB";
  maxQuantity?: number;
  defaultQuantity?: number;
  score: number;
  priority: DefensePriority;
  protectionType?: string;
  coverageWeight?: number;
  compoundProfile?: DefenseAssetCompoundProfile;
  iconUrl?: string;
};

export type SelectedConfiguration = {
  id: string;
  name: string;
  source: DefenseConfigurationSource;
  selectedItems: Record<string, number>;
  basePresetId?: string;
  updatedAt: string;
};

export type EchelonCost = {
  echelonId: string;
  echelonName: string;
  totalMln: number;
};

export type EchelonCoverage = {
  echelonId: string;
  coveredPct: number;
};

export type PriorityItem = {
  itemId: string;
  title: string;
  score: number;
  priority: DefensePriority;
  quantity: number;
};

export type BudgetSelection = {
  selectedItems: Record<string, number>;
  spentMln: number;
  remainingMln: number;
};

export type SelectedConfigurationToPlacementsArgs = {
  configuration: SelectedConfiguration;
  facilityId: string;
  scenarioId: DefenseScenarioId;
};

export type CatalogPlacementDraft = Pick<
  Placement,
  | "id"
  | "assetId"
  | "facilityId"
  | "scenarioId"
  | "layerId"
  | "catalogGroupId"
  | "catalogGroupName"
  | "qty"
  | "readiness"
  | "layerGapBoost"
  | "criticalityBoost"
  | "feasibility"
  | "environmentModifier"
>;
