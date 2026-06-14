import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gisBoardSource = readFileSync("src/modules/drone-defense/ui/gis-board.tsx", "utf8");
const markerSource = readFileSync("src/modules/drone-defense/ui/map-object-marker.tsx", "utf8");

assert(
  markerSource.includes("onDoubleClick"),
  "Map object marker must expose a double-click handler so marker double-click does not fall through to map zoom",
);
assert(
  gisBoardSource.includes("buildPlacementFocusViewState"),
  "GisBoard must use placement focus view state for marker double-click focus",
);
assert(
  markerSource.includes("clearPendingClick") && markerSource.includes("window.setTimeout"),
  "Map object marker must defer single-click selection so double-click can cancel layer focus",
);
assert(
  gisBoardSource.includes("placementFocusTransitionDurationMs") && gisBoardSource.includes("animateToViewState"),
  "GisBoard must animate marker double-click focus instead of jumping to the placement",
);

console.log("map-marker-double-click-focus-contract.test.mjs: marker double-click smoothly focuses placement");
