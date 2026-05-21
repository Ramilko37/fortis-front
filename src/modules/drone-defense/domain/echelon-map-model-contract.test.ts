import { buildEchelonMapModel } from "@/modules/drone-defense/domain/echelon-map-model";
import {
  buildCatalogPlacement,
  buildCatalogResponse,
  buildScenarioConfiguration,
  defenseLayers,
  facilities,
} from "@/modules/drone-defense/infra/mock-defense-data";
import type { DefenseLayersResponse } from "@/shared/types/drone-defense";

const catalog = buildCatalogResponse();
const facility = facilities[0];
const hardeningPlacement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l9-armoring",
});
const configuration = buildScenarioConfiguration(facility.id, "balanced", [hardeningPlacement]);

const layerCoverage: DefenseLayersResponse = {
  facilityId: facility.id,
  scenarioId: "balanced",
  layerCoverage: defenseLayers.map((layer) => ({
    layerId: layer.id,
    coveredPct: layer.id === "layer_09_hardening" ? 0.72 : 0.12,
    distanceBandM: layer.distanceBandM,
  })),
};

const model = buildEchelonMapModel({
  facility,
  layers: defenseLayers,
  layerCoverage,
  configuration,
  catalog,
});

if (model.zones.length !== defenseLayers.length) {
  throw new Error("GIS must render one colored map zone for each L1-L9 echelon");
}

const externalZone = model.zones.find((zone) => zone.layerId === "layer_01_external_warning");
const hardeningZone = model.zones.find((zone) => zone.layerId === "layer_09_hardening");

if (!externalZone?.polygon.length || !hardeningZone?.polygon.length) {
  throw new Error("Every echelon zone must expose a map polygon");
}

if (externalZone.fillColor.join(",") === hardeningZone.fillColor.join(",")) {
  throw new Error("Different echelons must have different color layers on the map");
}

if (!model.placements.some((placement) => placement.layerId === "layer_09_hardening" && placement.isCatalogPlacement)) {
  throw new Error("Catalog placements must appear as objects inside their selected map echelon");
}
