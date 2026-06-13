// Run: pnpm dlx tsx src/modules/drone-defense/domain/prototype-workflow-contract.test.ts
import assert from "node:assert/strict";
import { createDefaultDefenseProject } from "@/shared/lib/defense-project";
import {
  buildWizardLayer,
  formatDistance,
  layerInsertOptionKey,
  parseCoordinatePlacementInput,
  projectLayerToMapLayer,
} from "@/modules/drone-defense/domain/prototype-workflow";
import type { LayerInsertOption } from "@/shared/lib/defense-project";

const project = createDefaultDefenseProject();

assert.equal(formatDistance(500), "500 м");
assert.equal(formatDistance(2500), "2,5 км");

const option: LayerInsertOption = {
  kind: "between",
  label: "Между L2 и L1",
  beforeLayerId: "layer-before",
  afterLayerId: "layer-after",
  minInnerRadiusM: 1000,
  maxOuterRadiusM: 3000,
  availableWidthM: 2000,
};
assert.equal(layerInsertOptionKey(option), "between:layer-before:layer-after");

const wizardLayer = buildWizardLayer(project, {
  name: "Тестовый эшелон",
  code: "LT",
  innerRadiusM: 1000,
  widthM: 2000,
});
assert.equal(wizardLayer.name, "Тестовый эшелон");
assert.equal(wizardLayer.code, "LT");
assert.equal(wizardLayer.geometry.type, "ring");

const mapLayer = projectLayerToMapLayer(wizardLayer);
assert.equal(mapLayer.name, "Тестовый эшелон");
assert.equal(mapLayer.shortName, "LT");
assert.deepEqual(mapLayer.distanceBandM, {
  min: 1000,
  max: 3000,
  label: "1 км-3 км",
});

const parsed = parseCoordinatePlacementInput({
  lat: "55,44",
  lng: "37.10",
  altitude: "120",
  notes: "Проверочная точка",
});
assert.equal(parsed.ok, true);
if (parsed.ok) {
  assert.deepEqual(parsed.coordinates, { lat: 55.44, lng: 37.1, altitude: 120 });
  assert.equal(parsed.notes, "Проверочная точка");
}

const invalid = parseCoordinatePlacementInput({ lat: "91", lng: "37", altitude: "", notes: "" });
assert.equal(invalid.ok, false);

console.log("prototype-workflow-contract: OK");
