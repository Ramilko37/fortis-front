import { describePlacement, placementStatus, getMarkerState, buildSectorPolygon, getCoverageShape, screenPointToSlot } from "@/modules/drone-defense/domain/placement-helpers";
import {
  buildCatalogPlacement,
  buildCatalogResponse,
  buildScenarioConfiguration,
  defenseLayers,
  facilities,
} from "@/modules/drone-defense/infra/mock-defense-data";
import { buildEchelonMapModel } from "@/modules/drone-defense/domain/echelon-map-model";

const catalog = buildCatalogResponse();
const facility = facilities[0];

const placement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l2-radar",
  slotId: "layer_02_detection-slot-01",
});

const summary = describePlacement({ placement, catalog, layers: defenseLayers });

if (summary.name !== "РЛС") {
  throw new Error(`describePlacement must use the catalog group name; got ${summary.name}`);
}
if (summary.echelonShortName !== "L2") {
  throw new Error(`describePlacement must resolve the echelon short name; got ${summary.echelonShortName}`);
}
if (summary.qty !== 1) {
  throw new Error(`describePlacement must report qty; got ${summary.qty}`);
}
if (summary.costRub !== 42_000_000) {
  throw new Error(`describePlacement must compute cost = capex * qty; got ${summary.costRub}`);
}
// fixture placement has readiness 0.72 → "ready"
if (summary.status !== "ready") {
  throw new Error(`describePlacement must return "ready" for readiness 0.72; got ${summary.status}`);
}

if (placementStatus(0.05) !== "inactive") throw new Error("0.05 must be inactive (inclusive floor)");
if (placementStatus(0.04) !== "inactive") throw new Error("0.04 must be inactive");
if (placementStatus(0.39) !== "warning") throw new Error("0.39 must be warning");
if (placementStatus(0.4) !== "ready") throw new Error("0.40 must be ready (exclusive upper)");
if (placementStatus(0.72) !== "ready") throw new Error("0.72 must be ready");

const readyPlacement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l2-optical",
  slotId: "layer_02_detection-slot-02",
});

// default: placed, healthy, not selected/hovered
if (getMarkerState({ placement: readyPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: false }) !== "default") {
  throw new Error("a healthy unselected placement must be in the default state");
}

// hover beats default
if (getMarkerState({ placement: readyPlacement, selectedPlacementId: null, hoveredPlacementId: readyPlacement.id, isDuplicateInSlot: false }) !== "hover") {
  throw new Error("hover must override default");
}

// selected beats everything
if (getMarkerState({ placement: readyPlacement, selectedPlacementId: readyPlacement.id, hoveredPlacementId: readyPlacement.id, isDuplicateInSlot: true }) !== "selected") {
  throw new Error("selected must win over conflict, warning, hover");
}

// conflict beats warning/inactive/hover when not selected
const conflictPlacement = { ...readyPlacement, readiness: 0.2 };
if (getMarkerState({ placement: conflictPlacement, selectedPlacementId: null, hoveredPlacementId: conflictPlacement.id, isDuplicateInSlot: true }) !== "conflict") {
  throw new Error("conflict must win over warning and hover");
}

// conflict must win even over inactive (near-zero readiness)
const deadConflictPlacement = { ...readyPlacement, readiness: 0 };
if (getMarkerState({ placement: deadConflictPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: true }) !== "conflict") {
  throw new Error("conflict must win over inactive");
}

// warning from low readiness
const warnPlacement = { ...readyPlacement, readiness: 0.2 };
if (getMarkerState({ placement: warnPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: false }) !== "warning") {
  throw new Error("low readiness must yield warning");
}

// inactive from near-zero readiness
const offPlacement = { ...readyPlacement, readiness: 0 };
if (getMarkerState({ placement: offPlacement, selectedPlacementId: null, hoveredPlacementId: null, isDuplicateInSlot: false }) !== "inactive") {
  throw new Error("near-zero readiness must yield inactive");
}

// --- Task 3: buildSectorPolygon + getCoverageShape ---

const center = { lon: facility.center.lon, lat: facility.center.lat };
const ring = buildSectorPolygon({ center, azimuthDeg: 0, halfAngleDeg: 45, radiusM: 1000, segments: 16 });

if (ring.length < 4) {
  throw new Error(`sector polygon must have an apex and arc points; got ${ring.length}`);
}
const apex = ring[0];
if (Math.abs(apex[0] - center.lon) > 1e-9 || Math.abs(apex[1] - center.lat) > 1e-9) {
  throw new Error("sector polygon must start at the center apex");
}
const last = ring[ring.length - 1];
if (apex[0] === last[0] && apex[1] === last[1]) {
  throw new Error("sector ring must not duplicate the apex as its last point");
}

// detection/optical assets default to a sector coverage
const radarShape = getCoverageShape(readyPlacement); // readyPlacement is l2-optical (detection)
if (radarShape.kind !== "sector") {
  throw new Error(`detection/optical assets should default to a sector coverage; got ${radarShape.kind}`);
}

// kinetic group -> circle
const kineticPlacement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l6-barrel",
});
if (getCoverageShape(kineticPlacement).kind !== "circle") {
  throw new Error("kinetic assets should default to a circle coverage");
}

// --- Task 4: screenPointToSlot ---

const emptyConfig = buildScenarioConfiguration(facility.id, "balanced", []);
const dropModel = buildEchelonMapModel({
  facility,
  layers: defenseLayers,
  layerCoverage: null,
  configuration: emptyConfig,
  catalog,
  selectedLayerId: "layer_02_detection",
});
const detectionSlots = dropModel.slots.filter((slot) => slot.layerId === "layer_02_detection");
const target = detectionSlots[0];

const hit = screenPointToSlot({
  lon: target.position[0],
  lat: target.position[1],
  activeLayerId: "layer_02_detection",
  slots: dropModel.slots,
  maxDistanceM: 5000,
});
if (hit?.id !== target.id) {
  throw new Error(`screenPointToSlot must snap to the nearest active-echelon slot; got ${hit?.id}`);
}

const miss = screenPointToSlot({
  lon: target.position[0] + 5,
  lat: target.position[1] + 5,
  activeLayerId: "layer_02_detection",
  slots: dropModel.slots,
  maxDistanceM: 5000,
});
if (miss !== null) {
  throw new Error("a drop far from any slot must resolve to null");
}

const wrongLayer = screenPointToSlot({
  lon: target.position[0],
  lat: target.position[1],
  activeLayerId: "layer_09_hardening",
  slots: dropModel.slots,
  maxDistanceM: 5000,
});
// the point sits on a detection slot, but the active echelon is hardening:
// no detection slot may leak through, and hardening slots are too far → null
if (wrongLayer !== null) {
  throw new Error("screenPointToSlot must never return a slot from a non-active echelon");
}
