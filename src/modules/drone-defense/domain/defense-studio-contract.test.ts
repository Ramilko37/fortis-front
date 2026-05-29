import { buildScenarioConfiguration, scenarioOptions } from "@/modules/drone-defense/infra/mock-defense-data";
import { sceneObjectsFromConfiguration } from "@/modules/drone-defense/domain/configuration-scene-mapper";
import type { DefenseScenarioId, Placement, Recommendation } from "@/shared/types/drone-defense";

const scenarioIds = scenarioOptions.map((scenario) => scenario.id) satisfies DefenseScenarioId[];
const expectedScenarioIds: DefenseScenarioId[] = ["baseline", "balanced", "reinforced"];

if (scenarioIds.join("|") !== expectedScenarioIds.join("|")) {
  throw new Error(`Defense studio scenarios must stay unified: ${scenarioIds.join(", ")}`);
}

const localPlacement: Placement = {
  id: "facility-alpha-balanced-local-hardening",
  assetId: "asset-hardening-l9",
  facilityId: "facility-alpha",
  scenarioId: "balanced",
  qty: 1,
  readiness: 0.74,
  layerGapBoost: 1.08,
  criticalityBoost: 1.05,
  feasibility: 0.8,
  environmentModifier: 0.92,
  sceneRef: { x: 142, z: 88 },
};

const customConfiguration = buildScenarioConfiguration("facility-alpha", "balanced", [localPlacement]);
const containsLocalPlacement = customConfiguration.placements.some((placement) => placement.id === localPlacement.id);

if (!containsLocalPlacement) {
  throw new Error("buildScenarioConfiguration must preserve local 3D placements in the shared configuration");
}

const mappedObjects = sceneObjectsFromConfiguration(customConfiguration);
const localObject = mappedObjects.find((item) => item.id === localPlacement.id);

if (!localObject) {
  throw new Error("Configuration -> 3D mapping must include local placements from the shared configuration");
}

if (localObject.position[0] !== (localPlacement.sceneRef?.x ?? 0) || localObject.position[2] !== (localPlacement.sceneRef?.z ?? 0)) {
  throw new Error("Configuration -> 3D mapping must preserve sceneRef coordinates for local placements");
}

const baselineConfiguration = buildScenarioConfiguration("facility-alpha", "baseline");
const baselineObjects = sceneObjectsFromConfiguration(baselineConfiguration);
if (baselineObjects.some((item) => item.id === localPlacement.id)) {
  throw new Error("Scenario/facility switch must hard reset 3D scene from active configuration only");
}

const recommendation: Recommendation = {
  candidateAssetId: "asset-ew-l4",
  candidateAssetName: "Комплекс РЭБ подавления",
  affectedLayerIds: ["layer_04_suppression", "layer_07_accuracy_disruption"],
  reason: "Закрывает территориальный gap по L4/L7 (8-15 км и 0.5-1.5 км) для FPV и swarm угроз",
  deltaRisk: 0.64,
  deltaResidualRiskPct: 0.12,
  deltaTco: 47_200_000,
  score: 1.24e-8,
};

if (!recommendation.reason || recommendation.affectedLayerIds.length === 0 || recommendation.deltaRisk <= 0 || recommendation.deltaTco <= 0) {
  throw new Error("Recommendation cards must explain the next best action");
}
