// Run: npx tsx src/shared/lib/use-defense-project-store.test.ts

import {
  FORTIS_DEFENSE_PROJECT_STORAGE_KEY,
  useDefenseProjectStore,
} from "@/shared/lib/use-defense-project-store";
import { projectToCalculatorConfiguration } from "@/shared/lib/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  configurable: true,
});

storage.clear();
useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);

const initial = useDefenseProjectStore.getState().project;
const l2 = initial.layers.find((layer) => layer.code === "L2");
assert(l2, "store initial project must include L2");

useDefenseProjectStore.getState().selectLayer(l2.id);
useDefenseProjectStore.getState().selectAsset("mobile-radar");
useDefenseProjectStore.getState().placeObject("mobile-radar", l2.id, { lat: 55.44, lng: 37.1 });

const placed = useDefenseProjectStore.getState().project.placedObjects;
assert(placed.length === 1, "placeObject action must add a placed object");
assert(useDefenseProjectStore.getState().selectedObjectId === placed[0].id, "new placed object must become selected");
assert(storage.has(FORTIS_DEFENSE_PROJECT_STORAGE_KEY), "store must persist project after placement");

useDefenseProjectStore.getState().moveObject(placed[0].id, { lat: 55.45, lng: 37.1 });
assert(useDefenseProjectStore.getState().project.placedObjects[0].coordinates.lat === 55.45, "moveObject must update coordinates");

useDefenseProjectStore.getState().selectObject(placed[0].id);
assert(useDefenseProjectStore.getState().selectedObjectId === placed[0].id, "selectObject must expose object selection");

useDefenseProjectStore.getState().duplicatePlacedObject(placed[0].id);
assert(useDefenseProjectStore.getState().project.placedObjects.length === 2, "duplicatePlacedObject must add a second object");

const saved = storage.get(FORTIS_DEFENSE_PROJECT_STORAGE_KEY);
useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);
if (saved) storage.set(FORTIS_DEFENSE_PROJECT_STORAGE_KEY, saved);
useDefenseProjectStore.getState().restoreProjectFromLocalStorage();
assert(useDefenseProjectStore.getState().hydrated, "restore must mark store hydrated");
assert(useDefenseProjectStore.getState().project.placedObjects.length === 2, "restore must load placed objects");

useDefenseProjectStore.getState().deletePlacedObject(useDefenseProjectStore.getState().project.placedObjects[0].id);
assert(useDefenseProjectStore.getState().project.placedObjects.length === 1, "deletePlacedObject must remove an object");
useDefenseProjectStore.getState().selectObject(useDefenseProjectStore.getState().project.placedObjects[0].id);
const selectedForDelete = useDefenseProjectStore.getState().selectedObjectId;
assert(selectedForDelete, "store must have selected object before delete selection check");
useDefenseProjectStore.getState().deletePlacedObject(selectedForDelete);
assert(useDefenseProjectStore.getState().selectedObjectId === undefined, "deletePlacedObject must clear deleted selection");
assert(
  !projectToCalculatorConfiguration(useDefenseProjectStore.getState().project).lines.some((line) => line.assetId === "mobile-radar"),
  "deletePlacedObject must remove deleted object from calculation lines",
);

useDefenseProjectStore.getState().selectLayer(l2.id);
const coordinatePlacement = useDefenseProjectStore.getState().placeObject(
  "mobile-radar",
  l2.id,
  { lat: 55.44, lng: 37.1, altitude: 120 },
  { notes: "координатный ввод" },
);
assert(coordinatePlacement.isValid, "coordinate placement through store must validate inside the selected layer");
const coordinateObject = useDefenseProjectStore.getState().project.placedObjects.at(-1);
assert(coordinateObject?.coordinates.altitude === 120, "store coordinate placement must persist altitude");
assert(coordinateObject?.notes === "координатный ввод", "store coordinate placement must persist notes");
const outsidePlacementCount = useDefenseProjectStore.getState().project.placedObjects.length;
const outsidePlacement = useDefenseProjectStore.getState().placeObject("mobile-radar", l2.id, { lat: 55.2, lng: 37.1 });
assert(outsidePlacement.isValid, "store coordinate placement must allow points outside echelon geometry");
assert(useDefenseProjectStore.getState().project.placedObjects.length === outsidePlacementCount + 1, "outside coordinate placement must still add an object");

useDefenseProjectStore.getState().applyBudgetSelection([{ assetId: "mobile-radar", included: true }]);
assert(useDefenseProjectStore.getState().project.placedObjects.length === 1, "budget selection must create visible draft objects");
assert(useDefenseProjectStore.getState().project.placedObjects[0].quantity === 1, "budget draft object must keep selected quantity");
assert(useDefenseProjectStore.getState().project.placedObjects[0].status === "planned", "budget draft object must be planned");

useDefenseProjectStore.getState().loadPresetProject("nak");
const presetObjects = useDefenseProjectStore.getState().project.placedObjects;
const presetRadar = presetObjects.find((object) => object.assetId === "mobile-radar");
assert(presetObjects.length > 0, "loadPresetProject must create map-visible draft objects");
assert(presetRadar && presetRadar.quantity > 1, "loadPresetProject must preserve aggregate quantities on draft objects");
assert(
  projectToCalculatorConfiguration(useDefenseProjectStore.getState().project).lines.some((line) => line.assetId === "mobile-radar" && line.quantity === presetRadar.quantity),
  "preset draft objects must drive calculator lines",
);

useDefenseProjectStore.getState().clearProject();
useDefenseProjectStore.getState().selectLayer(l2.id);
useDefenseProjectStore.getState().placeObject("mobile-radar", l2.id, { lat: 55.44, lng: 37.1 });

const layerWithObject = useDefenseProjectStore.getState().project.placedObjects[0].layerId;
const blockedDeletion = useDefenseProjectStore.getState().deleteLayer(layerWithObject);
assert(!blockedDeletion.ok && blockedDeletion.reason === "layer-has-objects", "deleteLayer must return a warning result for layers with objects");
assert(
  useDefenseProjectStore.getState().project.layers.some((layer) => layer.id === layerWithObject),
  "blocked deleteLayer must keep the layer",
);

useDefenseProjectStore.getState().createLayer({ name: "Тестовый эшелон", code: "LT" });
const createdLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.code === "LT");
assert(createdLayer?.geometry.type === "ring", "createLayer must create editable ring geometry by default");

useDefenseProjectStore.getState().updateLayer(createdLayer.id, {
  geometry: { type: "ring", center: useDefenseProjectStore.getState().project.baseObject.center, minRadiusM: 5000, maxRadiusM: 15000 },
});
const updatedLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.id === createdLayer.id);
assert(updatedLayer?.geometry.type === "ring" && updatedLayer.geometry.minRadiusM === 5000 && updatedLayer.geometry.maxRadiusM === 15000, "updateLayer must persist custom ring geometry");

useDefenseProjectStore.getState().moveLayerUp(createdLayer.id);
const movedLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.id === createdLayer.id);
assert(movedLayer && movedLayer.order < updatedLayer.order, "moveLayerUp must decrease layer order");

useDefenseProjectStore.getState().setLayerVisibility(createdLayer.id, false);
const hiddenLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.id === createdLayer.id);
assert(hiddenLayer?.isVisible === false, "setLayerVisibility must persist hidden layer state");

useDefenseProjectStore.getState().setLayerLocked(createdLayer.id, true);
const lockedLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.id === createdLayer.id);
assert(lockedLayer?.isLocked, "setLayerLocked must persist locked layer state");

const lockedPlacement = useDefenseProjectStore.getState().placeObject("mobile-radar", createdLayer.id, { lat: 55.18, lng: 37.1 });
assert(lockedPlacement.isValid, "placeObject must allow locked layers");
assert(
  useDefenseProjectStore.getState().project.placedObjects.some((object) => object.layerId === createdLayer.id),
  "locked layer placement must still add an object",
);

const deletedLayer = useDefenseProjectStore.getState().deleteLayer(createdLayer.id);
assert(!deletedLayer.ok && deletedLayer.reason === "layer-locked", "deleteLayer must reject locked custom layers");

useDefenseProjectStore.getState().setLayerLocked(createdLayer.id, false);
useDefenseProjectStore.getState().deletePlacedObject(useDefenseProjectStore.getState().project.placedObjects.find((object) => object.layerId === createdLayer.id)?.id ?? "");
const unlockedDeletion = useDefenseProjectStore.getState().deleteLayer(createdLayer.id);
assert(unlockedDeletion.ok, "deleteLayer must delete unlocked empty custom layers");
assert(!useDefenseProjectStore.getState().project.layers.some((layer) => layer.id === createdLayer.id), "deleted empty layer must be removed from project");

const persisted = storage.get(FORTIS_DEFENSE_PROJECT_STORAGE_KEY);
assert(persisted?.includes("\"isVisible\""), "visibility changes must be persisted");

const draftCreated = useDefenseProjectStore.getState().createLayerFromDraft({
  name: "Свободный внешний эшелон",
  code: "LX",
  innerRadiusM: 120000,
  widthM: 10000,
});
assert(draftCreated.ok, "createLayerFromDraft must accept valid non-overlapping geometry");
const draftLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.code === "LX");
assert(
  draftLayer?.geometry.type === "ring" && draftLayer.geometry.minRadiusM === 120000 && draftLayer.geometry.maxRadiusM === 130000,
  "createLayerFromDraft must persist draft radii",
);
assert(storage.get(FORTIS_DEFENSE_PROJECT_STORAGE_KEY)?.includes("Свободный внешний эшелон"), "createLayerFromDraft must persist localStorage");

const draftRejected = useDefenseProjectStore.getState().createLayerFromDraft({
  name: "Пересекающийся",
  code: "LO",
  innerRadiusM: 59000,
  widthM: 3000,
});
assert(!draftRejected.ok, "createLayerFromDraft must reject overlapping geometry");
assert(!useDefenseProjectStore.getState().project.layers.some((layer) => layer.code === "LO"), "rejected draft must not mutate project");

const l2ForEdit = useDefenseProjectStore.getState().project.layers.find((layer) => layer.code === "L2");
assert(l2ForEdit, "store project must include L2 before geometry edit");
const editResult = useDefenseProjectStore.getState().updateLayerGeometry(l2ForEdit.id, {
  innerRadiusM: 50000,
  widthM: 5000,
});
assert(editResult.ok, "updateLayerGeometry must save valid edited geometry");
assert(useDefenseProjectStore.getState().project.placedObjects.length === 1, "updateLayerGeometry must not delete placed objects");
assert(
  useDefenseProjectStore.getState().project.placedObjects.every((object) => !object.hasGeometryConflict && !object.hasCoverageConflict && !object.hasTerrainConflict),
  "updateLayerGeometry must not mark existing objects as conflicts",
);

const l3ForTransfer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.code === "L3");
assert(l3ForTransfer, "store project must include L3 before transfer check");
const transferObject = useDefenseProjectStore.getState().project.placedObjects[0];
const crossGeometryTransfer = useDefenseProjectStore.getState().transferObjectToLayer(transferObject.id, l3ForTransfer.id);
assert(crossGeometryTransfer.isValid, "transferObjectToLayer must allow coordinates outside target layer");
assert(
  useDefenseProjectStore.getState().project.placedObjects[0].layerId === l3ForTransfer.id,
  "cross-geometry transferObjectToLayer must update layer",
);

const l2AfterEdit = useDefenseProjectStore.getState().project.layers.find((layer) => layer.code === "L2");
assert(l2AfterEdit, "store project must include edited L2 before valid transfer setup");
useDefenseProjectStore.getState().createLayerFromDraft({
  name: "Зеркало переноса",
  code: "LZ",
  innerRadiusM: 30000,
  widthM: 20000,
});
const mirrorTransferLayer = useDefenseProjectStore.getState().project.layers.find((layer) => layer.code === "LZ");
assert(mirrorTransferLayer, "mirror transfer layer must be created");
useDefenseProjectStore.getState().updatePlacedObject(transferObject.id, { coordinates: { lat: 55.44, lng: 37.1 } });
const validTransfer = useDefenseProjectStore.getState().transferObjectToLayer(transferObject.id, mirrorTransferLayer.id);
assert(validTransfer.isValid, "transferObjectToLayer must accept coordinates inside target layer");
assert(
  useDefenseProjectStore.getState().project.placedObjects[0].layerId === mirrorTransferLayer.id,
  "valid transferObjectToLayer must update layerId",
);

for (let index = 0; index < 30; index += 1) {
  useDefenseProjectStore.getState().createLayer({ name: `Лимит ${index}`, code: `LM${index}` });
}
assert(useDefenseProjectStore.getState().project.layers.length === 20, "createLayer must cap project layers at 20");

useDefenseProjectStore.getState().clearProject();
useDefenseProjectStore.getState().setBaseObjectCenter({ lat: 56.8389, lng: 60.5945 });
const recenteredProject = useDefenseProjectStore.getState().project;
const recenteredL2 = recenteredProject.layers.find((layer) => layer.code === "L2");
assert(recenteredProject.baseObject.center.lat === 56.8389, "setBaseObjectCenter must update the protected object center");
assert(
  recenteredL2?.geometry.type === "ring" && recenteredL2.geometry.center.lng === 60.5945,
  "setBaseObjectCenter must keep ring layer geometry aligned with the selected facility",
);

// ── budgetApplied flag (item 7) ──────────────────────────────────────────────
storage.clear();
useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);

{
  const s = useDefenseProjectStore.getState();
  assert(s.budgetApplied === false, "budgetApplied must default to false");

  // Applying a budget selection sets the flag true.
  const firstAssetId = s.project.assetLibrary[0]?.id;
  assert(firstAssetId, "expected at least one asset in library");
  s.applyBudgetSelection([{ assetId: firstAssetId, included: true }]);
  assert(
    useDefenseProjectStore.getState().budgetApplied === true,
    "applyBudgetSelection must set budgetApplied true",
  );

  // Any map mutation resets the flag to false.
  useDefenseProjectStore.getState().setAssetQuantity(firstAssetId, 2);
  assert(
    useDefenseProjectStore.getState().budgetApplied === false,
    "a map mutation must reset budgetApplied to false",
  );

  // clearProject resets the flag.
  useDefenseProjectStore.getState().applyBudgetSelection([{ assetId: firstAssetId, included: true }]);
  useDefenseProjectStore.getState().clearProject();
  assert(
    useDefenseProjectStore.getState().budgetApplied === false,
    "clearProject must reset budgetApplied to false",
  );

  // restoreProjectFromLocalStorage resets the flag.
  useDefenseProjectStore.getState().applyBudgetSelection([{ assetId: firstAssetId, included: true }]);
  assert(useDefenseProjectStore.getState().budgetApplied === true, "precondition: flag true before restore");
  useDefenseProjectStore.getState().saveProjectToLocalStorage();
  useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);
  useDefenseProjectStore.getState().restoreProjectFromLocalStorage();
  assert(
    useDefenseProjectStore.getState().budgetApplied === false,
    "restoreProjectFromLocalStorage must reset budgetApplied to false",
  );
}

// Selection-only actions must NOT reset the flag.
useDefenseProjectStore.setState(useDefenseProjectStore.getInitialState(), true);
{
  const st = useDefenseProjectStore.getState();
  const aId = st.project.assetLibrary[0]?.id;
  assert(aId, "expected an asset");
  st.applyBudgetSelection([{ assetId: aId, included: true }]);
  assert(useDefenseProjectStore.getState().budgetApplied === true, "precondition: flag true");
  useDefenseProjectStore.getState().selectAsset(aId);
  assert(
    useDefenseProjectStore.getState().budgetApplied === true,
    "selectAsset must NOT reset budgetApplied",
  );
}

console.log("budgetApplied flag: OK");

console.log("use-defense-project-store.test.ts: project store contracts passed");
