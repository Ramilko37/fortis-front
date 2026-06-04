import { getDefenseItemById } from "@/shared/config/defense-catalog";
import type { DefenseProject } from "@/shared/types/defense-project";
import type { DefenseLayerId, DefenseScenarioId, Placement } from "@/shared/types/drone-defense";

type PlacedObjectsToMapPlacementsArgs = {
  project: DefenseProject;
  facilityId: string;
  scenarioId: DefenseScenarioId;
};

export function placedObjectsToMapPlacements({
  project,
  facilityId,
  scenarioId,
}: PlacedObjectsToMapPlacementsArgs): Placement[] {
  return project.placedObjects.flatMap((object) => {
    const catalogItem = getDefenseItemById(object.assetId);
    const groupId = catalogItem?.mapCatalogGroupIds[0];
    if (!catalogItem || !groupId) return [];

    return [
      {
        id: object.id,
        assetId: catalogItem.mapAssetTemplateId ?? "asset-radar-l2",
        facilityId,
        scenarioId,
        layerId: object.layerId as DefenseLayerId,
        catalogGroupId: groupId,
        catalogGroupName: object.name ?? catalogItem.title,
        mapRef: {
          lat: object.coordinates.lat,
          lon: object.coordinates.lng,
        },
        qty: object.quantity,
        readiness: object.status === "active" ? 0.9 : 0.72,
        layerGapBoost: 1 + (catalogItem.coverageWeight ?? catalogItem.score) / 100,
        criticalityBoost: 1.05,
        feasibility: 0.82,
        environmentModifier: 0.92,
      },
    ];
  });
}
