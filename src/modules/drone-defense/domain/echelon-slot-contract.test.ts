import {
  buildEchelonMapModel,
  findNextBuildableCatalogGroupForLayer,
  getSlotBuildProfile,
} from "@/modules/drone-defense/domain/echelon-map-model";
import {
  buildCatalogPlacement,
  buildCatalogResponse,
  buildScenarioConfiguration,
  defenseLayers,
  facilities,
} from "@/modules/drone-defense/infra/mock-defense-data";
import type { DefenseLayersResponse } from "@/shared/types/drone-defense";

const facility = facilities[0];
const selectedLayer = defenseLayers.find((layer) => layer.id === "layer_04_suppression") ?? defenseLayers[0];
const slotId = `${selectedLayer.id}-slot-02`;
const mapRef = { lon: facility.center.lon + 0.03, lat: facility.center.lat + 0.02 };
const placement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l4-ew-gnss",
  slotId,
  mapRef,
});
const configuration = buildScenarioConfiguration(facility.id, "balanced", [placement]);
const layerCoverage: DefenseLayersResponse = {
  facilityId: facility.id,
  scenarioId: "balanced",
  layerCoverage: defenseLayers.map((layer) => ({
    layerId: layer.id,
    coveredPct: layer.id === selectedLayer.id ? 0.62 : 0.16,
    distanceBandM: layer.distanceBandM,
  })),
};
const model = buildEchelonMapModel({
  facility,
  layers: defenseLayers,
  layerCoverage,
  configuration,
  catalog: buildCatalogResponse(),
  selectedLayerId: selectedLayer.id,
  selectedSlotId: slotId,
});

const slotsByLayer = new Map(
  defenseLayers.map((layer) => [layer.id, model.slots.filter((slot) => slot.layerId === layer.id)]),
);

if (model.slots.length < defenseLayers.length * 3) {
  throw new Error("Every L1-L9 echelon must expose fixed activation slots on the map");
}

if (Array.from(slotsByLayer.values()).some((slots) => slots.length === 0)) {
  throw new Error("Every echelon layer must have at least one slot");
}

const occupiedSlot = model.slots.find((slot) => slot.id === slotId);

if (placement.slotId !== slotId || placement.mapRef?.lon !== mapRef.lon) {
  throw new Error("Catalog placement must preserve selected slot and map coordinates");
}

if (occupiedSlot?.status !== "occupied" || occupiedSlot.placementId !== placement.id) {
  throw new Error("A placement with slotId must mark that map slot as occupied");
}

if (!model.placements.some((item) => item.id.includes(slotId) && item.position[0] === mapRef.lon)) {
  throw new Error("Placement markers must use mapRef when the placement is bound to a slot");
}

const placedMarker = model.placements.find((item) => item.catalogGroupId === "l4-ew-gnss");

if (!placedMarker?.catalogGroupId) {
  throw new Error("Placement markers must expose catalogGroupId for GIS asset icon rendering");
}

for (const layer of defenseLayers) {
  const profile = getSlotBuildProfile(layer.id);
  if (!profile.glyph || !profile.title) {
    throw new Error(`Layer ${layer.shortName} must expose a tactical build icon profile`);
  }
}

const nextSuppressionGroup = findNextBuildableCatalogGroupForLayer({
  layerId: selectedLayer.id,
  catalogGroups: [
    { id: "l4-ew-gnss", layerId: selectedLayer.id, name: "already placed" },
    { id: "l4-ew-radio", layerId: selectedLayer.id, name: "next buildable" },
    { id: "l2-radar", layerId: "layer_02_detection", name: "wrong layer" },
  ],
  placements: configuration.placements,
});

if (nextSuppressionGroup?.id !== "l4-ew-radio") {
  throw new Error("Slot build action must pick the next unplaced catalog group for the clicked echelon");
}
