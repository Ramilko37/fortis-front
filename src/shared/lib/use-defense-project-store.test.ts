// Run: npx tsx src/shared/lib/use-defense-project-store.test.ts

import {
  FORTIS_DEFENSE_PROJECT_STORAGE_KEY,
  useDefenseProjectStore,
} from "@/shared/lib/use-defense-project-store";
import { calculateLayerConflicts } from "@/shared/lib/defense-project";

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
assert(!lockedPlacement.isValid, "placeObject must reject locked layers");

const deletedLayer = useDefenseProjectStore.getState().deleteLayer(createdLayer.id);
assert(!deletedLayer.ok && deletedLayer.reason === "layer-locked", "deleteLayer must reject locked custom layers");

useDefenseProjectStore.getState().setLayerLocked(createdLayer.id, false);
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
  calculateLayerConflicts(useDefenseProjectStore.getState().project, l2ForEdit.id).length === 1,
  "updateLayerGeometry may leave existing objects as conflicts",
);

for (let index = 0; index < 30; index += 1) {
  useDefenseProjectStore.getState().createLayer({ name: `Лимит ${index}`, code: `LM${index}` });
}
assert(useDefenseProjectStore.getState().project.layers.length === 20, "createLayer must cap project layers at 20");

console.log("use-defense-project-store.test.ts: project store contracts passed");
