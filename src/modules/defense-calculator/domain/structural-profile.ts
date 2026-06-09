// Structural profile of the live map (item 8). Pure — no JSX, no fetch.
// Replaces money-first comparison with structural metrics; cost is one optional field.

import {
  calculateLayerSummaries,
  calculateProjectTotalCost,
  calculateProjectTotalObjects,
  calculateProjectTotalUnits,
} from "@/shared/lib/defense-project";
import type { DefenseProject } from "@/shared/types/defense-project";

export type StructuralEchelonProfile = {
  layerId: string;
  layerCode: string;
  layerName: string;
  objectCount: number;
  unitCount: number;
  categoryCount: number;
  conflictCount: number;
  coverageZoneCount: number;
};

export type StructuralProfile = {
  objectCount: number;
  unitCount: number;
  echelonCount: number;
  categoryCount: number;
  conflictCount: number;
  coverageZoneCount: number;
  totalMln: number; // optional layer — cost is no longer the headline metric
  byEchelon: StructuralEchelonProfile[];
};

export function buildStructuralProfile(project: DefenseProject): StructuralProfile {
  const assetsById = new Map(project.assetLibrary.map((asset) => [asset.id, asset]));
  const summaries = calculateLayerSummaries(project);

  const categories = new Set<string>();
  let coverageZoneCount = 0;
  for (const object of project.placedObjects) {
    const asset = assetsById.get(object.assetId);
    if (!asset) continue;
    categories.add(asset.category);
    if (asset.coverageType !== "none") coverageZoneCount += 1;
  }

  const byEchelon: StructuralEchelonProfile[] = summaries
    .filter((summary) => summary.objectCount > 0)
    .map((summary) => {
      const objects = project.placedObjects.filter((object) => object.layerId === summary.layerId);
      const layerCategories = new Set<string>();
      let layerCoverageZones = 0;
      for (const object of objects) {
        const asset = assetsById.get(object.assetId);
        if (!asset) continue;
        layerCategories.add(asset.category);
        if (asset.coverageType !== "none") layerCoverageZones += 1;
      }
      return {
        layerId: summary.layerId,
        layerCode: summary.layerCode,
        layerName: summary.layerName,
        objectCount: summary.objectCount,
        unitCount: summary.unitCount,
        categoryCount: layerCategories.size,
        conflictCount: summary.conflictCount,
        coverageZoneCount: layerCoverageZones,
      };
    });

  return {
    objectCount: calculateProjectTotalObjects(project),
    unitCount: calculateProjectTotalUnits(project),
    echelonCount: byEchelon.length,
    categoryCount: categories.size,
    conflictCount: summaries.reduce((acc, summary) => acc + summary.conflictCount, 0),
    coverageZoneCount,
    totalMln: calculateProjectTotalCost(project),
    byEchelon,
  };
}
