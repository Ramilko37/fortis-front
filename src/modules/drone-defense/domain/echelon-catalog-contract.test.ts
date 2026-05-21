import {
  buildCatalogPlacement,
  buildScenarioConfiguration,
  defenseLayers,
  getCatalogGroupsForLayer,
} from "@/modules/drone-defense/infra/mock-defense-data";

const externalWarning = defenseLayers.find((layer) => layer.id === "layer_01_external_warning");
const hardening = defenseLayers.find((layer) => layer.id === "layer_09_hardening");

if (!externalWarning || !hardening) {
  throw new Error("L1 and L9 layers are required for interactive echelon configuration");
}

const externalGroups = getCatalogGroupsForLayer(externalWarning.id);
const hardeningGroups = getCatalogGroupsForLayer(hardening.id);

if (externalGroups.length < 3) {
  throw new Error("L1 must expose multiple protection groups that can be added to a configuration");
}

if (hardeningGroups.length < 2) {
  throw new Error("L9 must expose hardening protection groups that can be added to a configuration");
}

const placement = buildCatalogPlacement({
  facilityId: "facility-alpha",
  scenarioId: "balanced",
  groupId: externalGroups[0].id,
});

const configuration = buildScenarioConfiguration("facility-alpha", "balanced", [placement]);

if (!configuration.placements.some((item) => item.id === placement.id)) {
  throw new Error("Echelon catalog placement must become part of the shared configuration");
}

if (placement.layerId !== externalWarning.id || placement.catalogGroupId !== externalGroups[0].id) {
  throw new Error("Placement must preserve selected echelon and protection group identity");
}
