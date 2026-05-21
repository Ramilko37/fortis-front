import type {
  Configuration,
  DefenseAsset,
  DefenseCatalogResponse,
  DefenseLayer,
  DefenseLayerId,
  DefenseLayersResponse,
  Facility,
  GeoPoint,
  Placement,
} from "@/shared/types/drone-defense";

export type EchelonZone = {
  layerId: DefenseLayerId;
  shortName: string;
  name: string;
  distanceLabel: string;
  coveragePct: number;
  placedCount: number;
  polygon: Array<Array<[number, number]>>;
  fillColor: [number, number, number, number];
  lineColor: [number, number, number, number];
};

export type EchelonMapPlacement = {
  id: string;
  layerId: DefenseLayerId;
  label: string;
  position: [number, number];
  color: [number, number, number, number];
  isCatalogPlacement: boolean;
};

const layerColors: Record<DefenseLayerId, [number, number, number]> = {
  layer_01_external_warning: [37, 99, 235],
  layer_02_detection: [6, 182, 212],
  layer_03_identification: [20, 184, 166],
  layer_04_suppression: [34, 197, 94],
  layer_05_mid_range_kinetic: [132, 204, 22],
  layer_06_last_line_kinetic: [245, 158, 11],
  layer_07_accuracy_disruption: [249, 115, 22],
  layer_08_passive_protection: [239, 68, 68],
  layer_09_hardening: [168, 85, 247],
};

const layerOrderFactor = 37;

function projectMeters(center: GeoPoint, eastM: number, northM: number): [number, number] {
  const lat = center.lat + northM / 111_320;
  const lon = center.lon + eastM / (111_320 * Math.cos(center.lat * (Math.PI / 180)));
  return [lon, lat];
}

function circleRing(center: GeoPoint, radiusM: number, segments: number) {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return projectMeters(center, Math.sin(angle) * radiusM, Math.cos(angle) * radiusM);
  });
}

export function buildEchelonPolygon(center: GeoPoint, layer: DefenseLayer, segments = 96) {
  const outerRadius = Math.max(layer.distanceBandM.max, 120);
  const outer = circleRing(center, outerRadius, segments);

  if (layer.distanceBandM.min <= 0) {
    return [outer];
  }

  const inner = circleRing(center, layer.distanceBandM.min, segments).reverse();
  return [outer, inner];
}

function placementLayerIds(placement: Placement, assetsById: Map<string, DefenseAsset>) {
  if (placement.layerId) return [placement.layerId];
  return assetsById.get(placement.assetId)?.layerIds ?? [];
}

function placementPosition(center: GeoPoint, layer: DefenseLayer, placementIndex: number) {
  const min = layer.distanceBandM.min;
  const max = layer.distanceBandM.max;
  const radius = min === 0 ? Math.max(60, max * 0.55) : min + (max - min) * 0.55;
  const angle = ((placementIndex + 1) * layerOrderFactor + layer.order * 19) * (Math.PI / 180);
  return projectMeters(center, Math.sin(angle) * radius, Math.cos(angle) * radius);
}

export function buildEchelonMapModel({
  facility,
  layers,
  layerCoverage,
  configuration,
  catalog,
}: {
  facility: Facility | null;
  layers: DefenseLayer[];
  layerCoverage: DefenseLayersResponse | null;
  configuration: Configuration;
  catalog: DefenseCatalogResponse | null;
}) {
  const assetsById = new Map((catalog?.assets ?? []).map((asset) => [asset.id, asset]));
  const coverageByLayer = new Map(layerCoverage?.layerCoverage.map((item) => [item.layerId, item.coveredPct]) ?? []);
  const placementLayers = configuration.placements.flatMap((placement) =>
    placementLayerIds(placement, assetsById).map((layerId) => ({ placement, layerId })),
  );

  const zones: EchelonZone[] = facility
    ? layers.map((layer) => {
        const color = layerColors[layer.id];
        const coveragePct = coverageByLayer.get(layer.id) ?? 0;
        const placedCount = placementLayers.filter((item) => item.layerId === layer.id).length;
        return {
          layerId: layer.id,
          shortName: layer.shortName,
          name: layer.name,
          distanceLabel: layer.distanceBandM.label,
          coveragePct,
          placedCount,
          polygon: buildEchelonPolygon(facility.center, layer),
          fillColor: [...color, Math.round(32 + coveragePct * 88)] as [number, number, number, number],
          lineColor: [...color, 220] as [number, number, number, number],
        };
      })
    : [];

  const placements: EchelonMapPlacement[] = facility
    ? placementLayers.map(({ placement, layerId }, index) => {
        const layer = layers.find((item) => item.id === layerId) ?? layers[0];
        const asset = assetsById.get(placement.assetId);
        const color = layerColors[layerId];
        return {
          id: `${placement.id}:${layerId}`,
          layerId,
          label: placement.catalogGroupName ?? asset?.name ?? placement.assetId,
          position: placementPosition(facility.center, layer, index),
          color: [...color, 245] as [number, number, number, number],
          isCatalogPlacement: Boolean(placement.catalogGroupId),
        };
      })
    : [];

  return { zones, placements };
}
