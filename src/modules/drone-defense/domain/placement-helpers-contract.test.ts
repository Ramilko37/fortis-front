import { describePlacement, placementStatus, getMarkerState } from "@/modules/drone-defense/domain/placement-helpers";
import {
  buildCatalogPlacement,
  buildCatalogResponse,
  defenseLayers,
  facilities,
} from "@/modules/drone-defense/infra/mock-defense-data";

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
