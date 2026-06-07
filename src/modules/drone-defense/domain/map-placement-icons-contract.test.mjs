import { readFileSync } from "node:fs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const gisBoardSource = readFileSync("src/modules/drone-defense/ui/gis-board.tsx", "utf8");
const mapModelSource = readFileSync("src/modules/drone-defense/domain/echelon-map-model.ts", "utf8");
const adapterSource = readFileSync("src/modules/drone-defense/domain/project-map-adapter.ts", "utf8");

assert(
  !gisBoardSource.includes("placement.layerId !== selectedLayerId"),
  "Map icon layer must render dropped objects in the active echelon, not only other echelons",
);
assert(gisBoardSource.includes("markerOverlayPlacements"), "Map must project active echelon placements into the tactical marker overlay");
assert(gisBoardSource.includes("<MapObjectMarker"), "Dropped objects must render through tactical map markers");
assert(mapModelSource.includes("iconUrl?: string"), "Echelon map placements must carry optional iconUrl");
assert(adapterSource.includes("iconUrl:"), "Project map adapter must preserve asset iconUrl for map markers");

console.log("map-placement-icons-contract.test.mjs: dropped objects render as icons on the active echelon");
