import {
  defenseLayers,
  facilities,
  getLayerDistanceFit,
  measureGeoDistanceM,
} from "@/modules/drone-defense/infra/mock-defense-data";

const orderedLayers = [...defenseLayers].sort((a, b) => a.order - b.order);

if (orderedLayers.length !== 9) {
  throw new Error("Defense studio must model exactly nine protection echelons");
}

for (let index = 1; index < orderedLayers.length; index += 1) {
  const outer = orderedLayers[index - 1];
  const inner = orderedLayers[index];

  if (outer.distanceBandM.min < inner.distanceBandM.min) {
    throw new Error(`${outer.shortName} must be farther from the facility than ${inner.shortName}`);
  }
}

const alpha = facilities.find((facility) => facility.id === "facility-alpha");
if (!alpha) {
  throw new Error("facility-alpha fixture is required for layer distance tests");
}

const nearDistanceM = measureGeoDistanceM(alpha.center, { lon: 60.595, lat: 56.839 });
const farDistanceM = measureGeoDistanceM(alpha.center, { lon: 59.4, lat: 57.1 });

const l1 = orderedLayers[0];
const l9 = orderedLayers[8];

if (getLayerDistanceFit(l1, farDistanceM) <= getLayerDistanceFit(l9, farDistanceM)) {
  throw new Error("L1 must fit distant approach corridors better than L9");
}

if (getLayerDistanceFit(l9, nearDistanceM) <= getLayerDistanceFit(l1, nearDistanceM)) {
  throw new Error("L9 must fit near-facility hardening better than L1");
}
