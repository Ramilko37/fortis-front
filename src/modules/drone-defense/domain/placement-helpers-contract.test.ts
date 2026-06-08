import { describePlacement, placementStatus } from "@/modules/drone-defense/domain/placement-helpers";
import {
  buildCatalogPlacement,
  buildCatalogResponse,
  defenseLayers,
  facilities,
} from "@/modules/drone-defense/infra/mock-defense-data";

const catalog = buildCatalogResponse();
const facility = facilities[0];

const placement = buildCatalogPlacement({
  facilityId: facility.id,
  scenarioId: "balanced",
  groupId: "l2-radar",
  slotId: "layer_02_detection-slot-01",
});

const summary = describePlacement({ placement, catalog, layers: defenseLayers });

if (summary.name !== "РЛС") {
  throw new Error(`describePlacement must use the catalog group name; got ${summary.name}`);
}
if (summary.echelonShortName !== "L2") {
  throw new Error(`describePlacement must resolve the echelon short name; got ${summary.echelonShortName}`);
}
if (summary.qty !== 1) {
  throw new Error(`describePlacement must report qty; got ${summary.qty}`);
}
if (summary.costRub !== 42_000_000) {
  throw new Error(`describePlacement must compute cost = capex * qty; got ${summary.costRub}`);
}
// fixture placement has readiness 0.72 → "ready"
if (summary.status !== "ready") {
  throw new Error(`describePlacement must return "ready" for readiness 0.72; got ${summary.status}`);
}

if (placementStatus(0.05) !== "inactive") throw new Error("0.05 must be inactive (inclusive floor)");
if (placementStatus(0.04) !== "inactive") throw new Error("0.04 must be inactive");
if (placementStatus(0.39) !== "warning") throw new Error("0.39 must be warning");
if (placementStatus(0.4) !== "ready") throw new Error("0.40 must be ready (exclusive upper)");
if (placementStatus(0.72) !== "ready") throw new Error("0.72 must be ready");
