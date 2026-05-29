import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  getBuildAssetForCatalogGroup,
  getBuildOptionForSlot,
} from "@/modules/drone-defense/domain/echelon-build-assets";
import { buildScenarioConfiguration, echelonCatalogGroups } from "@/modules/drone-defense/infra/mock-defense-data";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import type { Placement } from "@/shared/types/drone-defense";

const publicRoot = join(process.cwd(), "public");

for (const group of echelonCatalogGroups) {
  const asset = getBuildAssetForCatalogGroup(group.id);

  if (!asset) {
    throw new Error(`${group.id} must have a build asset icon or placeholder`);
  }

  if (asset.layerId !== group.layerId) {
    throw new Error(`${group.id} build asset must stay on the same echelon layer`);
  }

  if (!existsSync(join(publicRoot, asset.imageUrl))) {
    throw new Error(`${group.id} icon file must exist at public/${asset.imageUrl}`);
  }
}

const l1Slot: EchelonMapSlot = {
  id: "layer_01_external_warning-slot-02",
  layerId: "layer_01_external_warning",
  slotIndex: 2,
  label: "S2",
  position: [60.1, 56.1],
  status: "empty",
  color: [255, 255, 255, 235],
};
const option = getBuildOptionForSlot({
  slot: l1Slot,
  catalogGroups: echelonCatalogGroups,
  placements: buildScenarioConfiguration("facility-alpha", "baseline").placements,
});

if (option?.groupId !== "l1-military-command") {
  throw new Error("L1 slot 2 must build the military command post asset");
}

const placedConfiguration = buildScenarioConfiguration("facility-alpha", "baseline", [
  {
    id: "facility-alpha-baseline-l1-military-command",
    assetId: "asset-radar-l2",
    facilityId: "facility-alpha",
    scenarioId: "baseline",
    layerId: "layer_01_external_warning",
    catalogGroupId: "l1-military-command",
    catalogGroupName: "Военная комендатура",
    slotId: l1Slot.id,
    mapRef: { lon: 60.1, lat: 56.1 },
    qty: 1,
    readiness: 0.72,
    layerGapBoost: 1,
    criticalityBoost: 1,
    feasibility: 0.82,
    environmentModifier: 0.92,
  } satisfies Placement,
]);

const blockedOption = getBuildOptionForSlot({
  slot: l1Slot,
  catalogGroups: echelonCatalogGroups,
  placements: placedConfiguration.placements,
});

if (blockedOption !== null) {
  throw new Error("A slot assigned to an already-built catalog group must not build a duplicate");
}

const l4Slot: EchelonMapSlot = {
  id: "layer_04_suppression-slot-01",
  layerId: "layer_04_suppression",
  slotIndex: 1,
  label: "S1",
  position: [60.2, 56.2],
  status: "empty",
  color: [255, 255, 255, 235],
};
const placeholderOption = getBuildOptionForSlot({
  slot: l4Slot,
  catalogGroups: echelonCatalogGroups,
  placements: [],
});

if (placeholderOption?.groupId !== "l4-ew-gnss" || !placeholderOption.imageUrl.includes("placeholders/l4.svg")) {
  throw new Error("Layers without final art must still expose placeholder build icons");
}
