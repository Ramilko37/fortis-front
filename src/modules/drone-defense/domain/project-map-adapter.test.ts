// Run: npx tsx src/modules/drone-defense/domain/project-map-adapter.test.ts

import { applyAssetQuantityDraftsToProject, createDefaultDefenseProject, placeObjectInProject, updateLayerGeometryFromRadii } from "@/shared/lib/defense-project";
import { placedObjectsToMapPlacements } from "@/modules/drone-defense/domain/project-map-adapter";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const project = createDefaultDefenseProject();
const l2 = project.layers.find((layer) => layer.code === "L2");
assert(l2, "test requires L2 layer");
const l5 = project.layers.find((layer) => layer.code === "L5");
assert(l5, "test requires L5 layer");

const placedProject = placeObjectInProject(project, "mobile-radar", l2.id, { lat: 55.44, lng: 37.1 });
const placements = placedObjectsToMapPlacements({
  project: { ...placedProject, selectedObjectId: placedProject.placedObjects[0].id },
  facilityId: "facility-alpha",
  scenarioId: "baseline",
});

assert(placements.length === 1, "placed object must produce one map placement");
assert(placements[0].catalogGroupId === "l2-radar", "mobile-radar placement must use l2-radar map group");
assert(placements[0].layerId === l2.id, "map placement must keep project layer id");
assert(placements[0].qty === 1, "map placement qty must reflect object quantity");
assert(placements[0].readiness === 0.72, "planned map placement must expose planned readiness");
assert(placements[0].mapRef?.lat === 55.44 && placements[0].mapRef?.lon === 37.1, "map placement must carry object coordinates");
assert(placements[0].isSelected, "map placement must expose selected object state");

const activeAggregateProject = {
  ...applyAssetQuantityDraftsToProject(project, [{ assetId: "mobile-radar", quantity: 4 }]),
};
activeAggregateProject.placedObjects = activeAggregateProject.placedObjects.map((object) => ({ ...object, status: "active" as const }));
const aggregatePlacements = placedObjectsToMapPlacements({
  project: activeAggregateProject,
  facilityId: "facility-alpha",
  scenarioId: "baseline",
});
assert(aggregatePlacements.length === 1, "aggregate draft object must produce one map placement");
assert(aggregatePlacements[0].qty === 4, "aggregate map placement qty must reflect object quantity");
assert(aggregatePlacements[0].readiness === 0.9, "active map placement must expose active readiness");

const reshapedProject = {
  ...placedProject,
  layers: placedProject.layers.map((layer) =>
    layer.id === l2.id ? updateLayerGeometryFromRadii(layer, { innerRadiusM: 50000, widthM: 5000 }) : layer,
  ),
};
const reshapedPlacements = placedObjectsToMapPlacements({
  project: reshapedProject,
  facilityId: "facility-alpha",
  scenarioId: "baseline",
});
assert(!reshapedPlacements[0].isConflict, "map placement must not expose conflict state for objects outside layer geometry");

const aircraftProject = placeObjectInProject(project, "aircraft", l5.id, { lat: 55.15, lng: 37.1 });
const fallbackPlacements = placedObjectsToMapPlacements({
  project: aircraftProject,
  facilityId: "facility-alpha",
  scenarioId: "baseline",
});
assert(fallbackPlacements.length === 1, "assets without map catalog groups must still produce fallback map placements");
assert(fallbackPlacements[0].catalogGroupId === undefined, "fallback map placements must not pretend to have a legacy group");
assert(fallbackPlacements[0].catalogGroupName === "Самолёты", "fallback map placement must keep the asset name");

console.log("project-map-adapter.test.ts: placed objects map adapter passed");
