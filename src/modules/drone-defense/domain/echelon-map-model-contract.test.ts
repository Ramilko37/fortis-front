import { buildEchelonMapModel, buildLayerFocusViewState } from "@/modules/drone-defense/domain/echelon-map-model";
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

const hardeningRing = hardeningZone.polygon[0];
if (!hardeningRing) {
  throw new Error("L9 hardening zone must expose an outer ring");
}

const firstHardeningPoint = hardeningRing[0];
const lastHardeningPoint = hardeningRing[hardeningRing.length - 1];
if (firstHardeningPoint?.[0] === lastHardeningPoint?.[0] && firstHardeningPoint?.[1] === lastHardeningPoint?.[1]) {
  throw new Error("Map polygon rings must not duplicate the first point; deck.gl closes rings internally");
}

if (externalZone.fillColor.join(",") === hardeningZone.fillColor.join(",")) {
  throw new Error("Different echelons must have different color layers on the map");
}

if (!model.placements.some((placement) => placement.layerId === "layer_09_hardening" && placement.isCatalogPlacement)) {
  throw new Error("Catalog placements must appear as objects inside their selected map echelon");
}

const customLayer = {
  ...defenseLayers[1],
  id: "project_custom_detection" as typeof defenseLayers[number]["id"],
  order: 10,
  shortName: "L10",
  name: "Проектный эшелон",
};

const customModel = buildEchelonMapModel({
  facility,
  layers: [customLayer],
  layerCoverage: null,
  configuration: { facilityId: facility.id, scenarioId: "balanced", placements: [] },
  catalog,
  selectedLayerId: customLayer.id,
});

const customZone = customModel.zones[0];
if (!customZone?.fillColor.every((channel) => Number.isFinite(channel))) {
  throw new Error("Custom project layers must receive a finite fallback map color");
}

if (!customModel.slots.length) {
  throw new Error("Custom project layers must receive fallback build slots");
}

const externalWarningLayer = defenseLayers.find((layer) => layer.id === "layer_01_external_warning");
const hardeningLayer = defenseLayers.find((layer) => layer.id === "layer_09_hardening");

if (!externalWarningLayer || !hardeningLayer) {
  throw new Error("L1 and L9 fixtures are required for layer focus tests");
}

const externalWarningFocus = buildLayerFocusViewState({
  facility,
  layer: externalWarningLayer,
});
const hardeningFocus = buildLayerFocusViewState({
  facility,
  layer: hardeningLayer,
});

if (externalWarningFocus.longitude !== facility.center.lon || externalWarningFocus.latitude !== facility.center.lat) {
  throw new Error("Layer focus must center the map on the selected facility");
}

if (externalWarningFocus.zoom >= hardeningFocus.zoom) {
  throw new Error("L1 focus must zoom out farther than L9 focus");
}

if (hardeningFocus.zoom > 18) {
  throw new Error("L9 focus zoom must be capped to avoid over-zooming inside the facility");
}

const smoothEasing = (value: number) => value;
const smoothFocus = buildLayerFocusViewState({
  facility,
  layer: hardeningLayer,
  transition: {
    durationMs: 1200,
    easing: smoothEasing,
  },
});

if (smoothFocus.transitionDuration !== 1200 || smoothFocus.transitionEasing !== smoothEasing) {
  throw new Error("Layer focus must preserve smooth transition timing and easing");
}
