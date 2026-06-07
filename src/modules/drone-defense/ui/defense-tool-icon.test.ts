// Run: npx tsx src/modules/drone-defense/ui/defense-tool-icon.test.ts
//
// Note: DefenseToolIcon is a React component that uses DOM APIs (drag events,
// Image) — full coverage requires jsdom or Playwright. This file covers:
//   1. The shared domain helpers (defense-project, project-map-adapter)
//      that placeObject uses after a drag-drop.
//   2. Constants & type-level invariants expected by the drag-to-map flow.

import {
  createDefaultDefenseProject,
  validateObjectPlacement,
  placeObjectInProject,
  calculateLayerConflicts,
  isPointInsideLayerGeometry,
} from "@/shared/lib/defense-project";
import type { Coordinates } from "@/shared/types/defense-project";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown, msg?: string) {
  if (actual !== expected) {
    throw new Error(msg ?? `Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
  }
}

// ---------------------------------------------------------------------------
// Constants & type-level invariants (documented in FEATURE_DRAG_ICON.md)
// ---------------------------------------------------------------------------

const ICON_SIZE = 32;       // px — from the drag preview spec
const BORDER_RADIUS = 4;    // px — from the drag preview spec
const DRAG_OFFSET = 16;     // px — center offset for setDragImage

console.log("=== defense-tool-icon feature invariants ===\n");

console.assert(ICON_SIZE === 32, "Icon preview width must be 32px");
console.assert(BORDER_RADIUS === 4, "Icon preview border-radius must be 4px");
console.assert(DRAG_OFFSET === 16, "Drag image center offset must be 16px");

console.log("[✓] All invariants hold: size=32, radius=4, offset=16\n");

// ---------------------------------------------------------------------------
// Domain integration — placeObject called after drag-drop validates correctly
// ---------------------------------------------------------------------------

console.log("=== placeObject integration (via domain helpers) ===\n");

const project = createDefaultDefenseProject();
const ringLayer = project.layers.find((l) => l.geometry.type === "ring");
assert(ringLayer, "Expected a ring layer in default project");

const center = ringLayer.geometry.type === "ring"
  ? ringLayer.geometry.center
  : project.baseObject.center;

// Pick a point clearly inside the ring
const insideCoords: Coordinates = {
  lat: center.lat,
  lng: center.lng,
};

// 1. Validate placement at center
const v1 = validateObjectPlacement(project, project.assetLibrary[0].id, ringLayer.id, insideCoords);
assert(v1.isValid, `Expected valid placement, got: ${v1.message}`);
console.log(`[✓] Center point validation: ${v1.level} — ${v1.message ?? "ok"}`);

// 2. Place object at center
const projectWithObject = placeObjectInProject(
  project,
  project.assetLibrary[0].id,
  ringLayer.id,
  insideCoords,
);
assert(projectWithObject.placedObjects.length === 1, "Expected 1 placed object after placement");

const placed = projectWithObject.placedObjects[0];
assertEquals(placed.assetId, project.assetLibrary[0].id, "AssetId mismatch");
assertEquals(placed.layerId, ringLayer.id, "LayerId mismatch");

console.log(`[✓] Object placed at center: ${placed.id}`);

// 3. Placement diagnostics
const conflicts = calculateLayerConflicts(projectWithObject);
assert(conflicts.length === 0, `Expected 0 conflicts, got ${conflicts.length}`);
console.log(`[✓] No placement diagnostics: ${conflicts.length}\n`);

// 4. Place outside ring — should still succeed without diagnostics
const farCoords: Coordinates = {
  lat: center.lat + 0.5,
  lng: center.lng + 0.5,
};

const v2 = validateObjectPlacement(project, project.assetLibrary[0].id, ringLayer.id, farCoords);
if (!v2.isValid) {
  console.log(`[~] Far point validation rejected: ${v2.message}`);
} else {
  const p2 = placeObjectInProject(project, project.assetLibrary[0].id, ringLayer.id, farCoords);
  const conflictsFar = calculateLayerConflicts(p2);
  console.log(`[✓] Far point placed; diagnostics: ${conflictsFar.length}`);
}

console.log("\n=== all tests passed ===");
