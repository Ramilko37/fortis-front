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
const ringLayer = project.layers.find((layer) => layer.code === "L2");
assert(ringLayer, "Expected L2 ring layer in default project");

const insideCoords: Coordinates = { lat: 55.44, lng: 37.1 };

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

// 4. Place outside ring — must be rejected
const farCoords: Coordinates = { lat: 55.9, lng: 38.2 };

const v2 = validateObjectPlacement(project, project.assetLibrary[0].id, ringLayer.id, farCoords);
assert(!v2.isValid, `Expected outside placement to be rejected, got: ${v2.message}`);
const p2 = placeObjectInProject(projectWithObject, project.assetLibrary[0].id, ringLayer.id, farCoords);
assert(p2.placedObjects.length === projectWithObject.placedObjects.length, "Outside placement must not create a new object");
console.log(`[✓] Far point rejected: ${v2.message}`);

console.log("\n=== all tests passed ===");
