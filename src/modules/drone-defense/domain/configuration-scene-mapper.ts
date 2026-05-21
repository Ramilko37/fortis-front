import { defenseAssets } from "@/modules/drone-defense/infra/mock-defense-data";
import type { Configuration, Placement } from "@/shared/types/drone-defense";
import {
  kindLabel,
  objectDefaultsByKind,
  type ObjectKind,
  type SceneObject,
} from "@/modules/drone-defense/domain/prototype-types";

const DEFAULT_ASSET_ANCHORS: Record<string, [number, number, number]> = {
  "asset-radar-l2": [-18, 0, 220],
  "asset-ew-l4": [35, 0, 254],
  "asset-kinetic-l6": [297, 0, -300],
  "asset-passive-l8": [174, 0, 174],
  "asset-hardening-l9": [10, 0, 176],
};

const assetsById = new Map(defenseAssets.map((asset) => [asset.id, asset]));

export function isLocalPlacementId(id: string) {
  return id.startsWith("local-");
}

function fallbackAnchor(assetId: string, occurrence: number): [number, number, number] {
  const [x, y, z] = DEFAULT_ASSET_ANCHORS[assetId] ?? [0, 0, 0];
  const shift = occurrence * 14;
  return [x + shift, y, z + shift];
}

export function sceneObjectsFromConfiguration(configuration: Configuration): SceneObject[] {
  const occurrences = new Map<string, number>();

  return configuration.placements
    .map((placement) => {
      const asset = assetsById.get(placement.assetId);
      if (!asset) return null;

      const kind = asset.kind as ObjectKind;
      const defaults = objectDefaultsByKind[kind];
      if (!defaults) return null;

      const occurrence = occurrences.get(placement.assetId) ?? 0;
      occurrences.set(placement.assetId, occurrence + 1);

      const [baseX, baseY, baseZ] = fallbackAnchor(placement.assetId, occurrence);
      const x = placement.sceneRef?.x ?? baseX;
      const z = placement.sceneRef?.z ?? baseZ;

      return {
        id: placement.id,
        kind,
        label: `${kindLabel[kind]} ${String(occurrence + 1).padStart(2, "0")}`,
        position: [x, baseY, z],
        radius: defaults.coverageRadiusM,
        coverageRadiusM: defaults.coverageRadiusM,
        elevation: defaults.elevation,
        zones: defaults.zones,
        assignment: isLocalPlacementId(placement.id) ? "Локально добавлено" : "Конфигурация",
        defenseRole: defaults.defenseRole,
        costMln: defaults.costMln,
        effectiveness: Math.max(0.35, Math.min(0.95, placement.readiness)),
      } satisfies SceneObject;
    })
    .filter((item): item is SceneObject => item !== null);
}

export function localPlacementFromSceneObject(
  object: SceneObject,
  facilityId: string,
  scenarioId: Configuration["scenarioId"],
): Placement | null {
  const asset = defenseAssets.find((item) => item.kind === object.kind);
  if (!asset) return null;

  return {
    id: object.id,
    assetId: asset.id,
    facilityId,
    scenarioId,
    qty: 1,
    readiness: Math.max(0.35, Math.min(0.95, object.effectiveness)),
    layerGapBoost: 1.08,
    criticalityBoost: 1.05,
    feasibility: 0.8,
    environmentModifier: 0.92,
    sceneRef: {
      x: object.position[0],
      z: object.position[2],
    },
  };
}
