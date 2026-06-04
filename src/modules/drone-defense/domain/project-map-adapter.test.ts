// Run: npx tsx src/modules/drone-defense/domain/project-map-adapter.test.ts

import { createDefaultDefenseProject, placeObjectInProject } from "@/shared/lib/defense-project";
import { placedObjectsToMapPlacements } from "@/modules/drone-defense/domain/project-map-adapter";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const project = createDefaultDefenseProject();
const l2 = project.layers.find((layer) => layer.code === "L2");
assert(l2, "test requires L2 layer");

const placedProject = placeObjectInProject(project, "mobile-radar", l2.id, { lat: 55.44, lng: 37.1 });
const placements = placedObjectsToMapPlacements({
  project: placedProject,
  facilityId: "facility-alpha",
  scenarioId: "baseline",
});

assert(placements.length === 1, "placed object must produce one map placement");
assert(placements[0].catalogGroupId === "l2-radar", "mobile-radar placement must use l2-radar map group");
assert(placements[0].layerId === l2.id, "map placement must keep project layer id");
assert(placements[0].qty === 1, "map placement qty must reflect object quantity");
assert(placements[0].mapRef?.lat === 55.44 && placements[0].mapRef?.lon === 37.1, "map placement must carry object coordinates");

console.log("project-map-adapter.test.ts: placed objects map adapter passed");
