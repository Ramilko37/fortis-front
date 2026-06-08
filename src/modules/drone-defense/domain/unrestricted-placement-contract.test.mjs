import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const defenseProjectSource = readFileSync("src/shared/lib/defense-project.ts", "utf8");
const toolIconSource = readFileSync("src/modules/drone-defense/ui/defense-tool-icon.tsx", "utf8");
const toolsPanelSource = readFileSync("src/modules/drone-defense/ui/defense-tools-panel.tsx", "utf8");
const prototypeSource = readFileSync("src/modules/drone-defense/ui/drone-defense-prototype.tsx", "utf8");
const mapAdapterSource = readFileSync("src/modules/drone-defense/domain/project-map-adapter.ts", "utf8");
const placedPanelSource = readFileSync("src/modules/drone-defense/ui/placed-objects-panel.tsx", "utf8");

assert(defenseProjectSource.includes("canPlaceInActiveLayer: true"), "Catalog assets must always be placeable in the active echelon");
assert(!defenseProjectSource.includes("Не подходит для"), "Catalog must not expose incompatible-echelon copy");
assert(defenseProjectSource.includes("isPointInsideLayerGeometry"), "Placement validation must check echelon geometry");
assert(defenseProjectSource.includes("вне диапазона эшелона"), "Outside placement must expose echelon range error");
assert(!toolIconSource.includes("isLimited"), "Defense tool cards must not enforce max quantity limits");
assert(!toolIconSource.includes("isNonPhysical"), "Defense tool cards must not split non-physical assets into add-only cards");
assert(toolIconSource.includes("const canDrag = canAdd"), "Defense tool cards must make every enabled asset draggable");
assert(!toolsPanelSource.includes("disabledReason = assetItem.canPlaceInActiveLayer"), "Tools panel must not disable cards by compatibility");
assert(!prototypeSource.includes("asset.placementType === \"zone-object\""), "Map placement must not block zone-object assets");
assert(prototypeSource.includes("PlacedObjectsPanel"), "Prototype must render placed objects panel");
assert(mapAdapterSource.includes("isConflict: Boolean"), "Map adapter must expose conflict state from placed object flags");
assert(placedPanelSource.includes("Перетащите средство из библиотеки на карту"), "Placed objects panel must expose empty-state guidance");

console.log("unrestricted-placement-contract.test.mjs: placement stabilization contract passed");
