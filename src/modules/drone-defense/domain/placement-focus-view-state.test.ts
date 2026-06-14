import assert from "node:assert/strict";
import { buildPlacementFocusViewState } from "@/modules/drone-defense/domain/echelon-map-model";

const focus = buildPlacementFocusViewState({
  currentViewState: {
    longitude: 60.59,
    latitude: 56.83,
    zoom: 8.4,
    pitch: 28,
    bearing: 0,
  },
  placementPosition: [60.6123, 56.8456],
});

assert.equal(focus.longitude, 60.6123, "placement focus must center on placement longitude");
assert.equal(focus.latitude, 56.8456, "placement focus must center on placement latitude");
assert(focus.zoom > 8.4, "placement focus must zoom in from the current map zoom");
assert.equal(focus.zoom, 12.8, "placement focus must zoom one level closer than the previous 11.8 target");

const repeatedFocus = buildPlacementFocusViewState({
  currentViewState: focus,
  placementPosition: [60.6123, 56.8456],
});

assert(repeatedFocus.zoom >= focus.zoom, "repeated placement focus must never zoom out");
assert(repeatedFocus.zoom > focus.zoom, "repeated placement focus should keep zooming in before the map maximum");
assert.equal(repeatedFocus.zoom, 15.2, "repeated placement focus must keep the closer zoom step");

const highZoomFocus = buildPlacementFocusViewState({
  currentViewState: {
    longitude: 60.59,
    latitude: 56.83,
    zoom: 17.8,
    pitch: 28,
    bearing: 0,
  },
  placementPosition: [60.6123, 56.8456],
});

assert.equal(highZoomFocus.zoom, 18, "placement focus must cap zoom at the map maximum");

console.log("placement-focus-view-state.test.ts: placement double-click focus zooms in and stays centered");
