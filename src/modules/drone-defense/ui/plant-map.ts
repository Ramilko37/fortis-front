import mapJson from "./data/typical-chemical-plant-map.json";
import type { AssetType } from "@/config/assetDimensions";
import { withBasePath } from "@/shared/lib/base-path";

type Tuple2 = [number, number];
type Tuple3 = [number, number, number];

type RawObject = {
  id: string;
  name: string;
  type: string;
  modelKey: string;
  layer: string;
  zoneId: string;
  position: number[];
  rotation: number[];
  scale: number[];
  modelUrl?: string;
  assetType?: string;
  upAxis?: "Y" | "Z";
  scaleMode?: "exact" | "uniformByHeight";
  modelRotation?: number[];
  dimensions?: Record<string, number>;
  status?: string;
  selectable?: boolean;
};

type RawConnection = {
  id: string;
  name: string;
  type: string;
  layer: string;
  fromObjectId?: string;
  toObjectId?: string;
  points: number[][];
  diameter?: number;
  width?: number;
  status?: string;
  selectable?: boolean;
};

type RawZone = {
  id: string;
  name: string;
  layer: string;
  polygon: number[][];
  color: string;
  opacity: number;
};

type RawSite = {
  dimensions: {
    width: number;
    depth: number;
  };
  ground: {
    material?: {
      color?: string;
      roughness?: number;
    };
  };
  perimeter: {
    points: number[][];
    height: number;
  };
};

export type PlantMapObject = {
  id: string;
  name: string;
  type: string;
  modelKey: string;
  layer: string;
  zoneId: string;
  position: Tuple3;
  rotation: Tuple3;
  scale: Tuple3;
  modelUrl?: string;
  assetType?: AssetType;
  upAxis?: "Y" | "Z";
  scaleMode?: "exact" | "uniformByHeight";
  modelRotation?: Tuple3;
  dimensions: Record<string, number>;
  status: string;
  selectable: boolean;
};

export type PlantMapConnection = {
  id: string;
  name: string;
  type: string;
  layer: string;
  fromObjectId?: string;
  toObjectId?: string;
  points: Tuple3[];
  diameter?: number;
  width?: number;
  status: string;
  selectable: boolean;
};

export type PlantZone = {
  id: string;
  name: string;
  layer: string;
  polygon: Tuple2[];
  color: string;
  opacity: number;
};

type PlantSite = {
  width: number;
  depth: number;
  groundColor: string;
  groundRoughness: number;
  perimeterPoints: Tuple2[];
  fenceHeight: number;
};

type PlantMapShape = {
  site: RawSite;
  zones: RawZone[];
  objects: RawObject[];
  connections: RawConnection[];
};

function toTuple2(value: number[]): Tuple2 {
  return [value[0] ?? 0, value[1] ?? 0];
}

function toTuple3(value: number[]): Tuple3 {
  return [value[0] ?? 0, value[1] ?? 0, value[2] ?? 0];
}

const typedMap = mapJson as unknown as PlantMapShape;

const FACTORY_CLUSTER_OFFSETS: readonly Tuple2[] = [
  [-245, -175],
  [245, -175],
  [0, 200],
];
const OUTER_SITE_PADDING = 30;

function withZoneSuffix(zoneId: string, clusterIndex: number) {
  return `${zoneId}-cluster-${clusterIndex + 1}`;
}

function withObjectSuffix(objectId: string, clusterIndex: number) {
  return `${objectId}-cluster-${clusterIndex + 1}`;
}

function withConnectionSuffix(connectionId: string, clusterIndex: number) {
  return `${connectionId}-cluster-${clusterIndex + 1}`;
}

function shiftPoint2(point: Tuple2, offset: Tuple2): Tuple2 {
  return [point[0] + offset[0], point[1] + offset[1]];
}

function shiftPoint3(point: Tuple3, offset: Tuple2): Tuple3 {
  return [point[0] + offset[0], point[1], point[2] + offset[1]];
}

const expandedZonesRaw: RawZone[] = [];
const expandedObjectsRaw: RawObject[] = [];
const expandedConnectionsRaw: RawConnection[] = [];
const objectIdMapByCluster = new Map<number, Map<string, string>>();

for (const [clusterIndex, offset] of FACTORY_CLUSTER_OFFSETS.entries()) {
  for (const zone of typedMap.zones) {
    expandedZonesRaw.push({
      ...zone,
      id: withZoneSuffix(zone.id, clusterIndex),
      name: `${zone.name} (${clusterIndex + 1})`,
      polygon: zone.polygon.map((point) => {
        const shifted = shiftPoint2(toTuple2(point), offset);
        return [shifted[0], shifted[1]];
      }),
    });
  }

  const objectIdMap = new Map<string, string>();
  objectIdMapByCluster.set(clusterIndex, objectIdMap);

  for (const objectItem of typedMap.objects) {
    const nextId = withObjectSuffix(objectItem.id, clusterIndex);
    objectIdMap.set(objectItem.id, nextId);
    const shiftedPosition = shiftPoint3(toTuple3(objectItem.position), offset);
    expandedObjectsRaw.push({
      ...objectItem,
      id: nextId,
      zoneId: withZoneSuffix(objectItem.zoneId, clusterIndex),
      position: [shiftedPosition[0], shiftedPosition[1], shiftedPosition[2]],
    });
  }

  for (const connection of typedMap.connections) {
    expandedConnectionsRaw.push({
      ...connection,
      id: withConnectionSuffix(connection.id, clusterIndex),
      fromObjectId: connection.fromObjectId ? objectIdMap.get(connection.fromObjectId) ?? connection.fromObjectId : undefined,
      toObjectId: connection.toObjectId ? objectIdMap.get(connection.toObjectId) ?? connection.toObjectId : undefined,
      points: connection.points.map((point) => {
        const shifted = shiftPoint3(toTuple3(point), offset);
        return [shifted[0], shifted[1], shifted[2]];
      }),
    });
  }
}

const perimeterPointsRaw: Tuple2[] = [];
for (const offset of FACTORY_CLUSTER_OFFSETS) {
  for (const point of typedMap.site.perimeter.points) {
    perimeterPointsRaw.push(shiftPoint2(toTuple2(point), offset));
  }
}

let minX = Infinity;
let maxX = -Infinity;
let minZ = Infinity;
let maxZ = -Infinity;

for (const [x, z] of perimeterPointsRaw) {
  if (x < minX) minX = x;
  if (x > maxX) maxX = x;
  if (z < minZ) minZ = z;
  if (z > maxZ) maxZ = z;
}

const siteCenterX = (minX + maxX) / 2;
const siteCenterZ = (minZ + maxZ) / 2;
const expandedWidth = Math.ceil(maxX - minX + OUTER_SITE_PADDING * 2);
const expandedDepth = Math.ceil(maxZ - minZ + OUTER_SITE_PADDING * 2);

function recenter2(point: Tuple2): Tuple2 {
  return [point[0] - siteCenterX, point[1] - siteCenterZ];
}

function recenter3(point: Tuple3): Tuple3 {
  return [point[0] - siteCenterX, point[1], point[2] - siteCenterZ];
}

const expandedPerimeterPoints = [
  [-expandedWidth / 2, -expandedDepth / 2],
  [expandedWidth / 2, -expandedDepth / 2],
  [expandedWidth / 2, expandedDepth / 2],
  [-expandedWidth / 2, expandedDepth / 2],
] as Tuple2[];

export const plantSite: PlantSite = {
  width: expandedWidth,
  depth: expandedDepth,
  groundColor: typedMap.site.ground.material?.color ?? "#D8D3C4",
  groundRoughness: typedMap.site.ground.material?.roughness ?? 0.95,
  perimeterPoints: expandedPerimeterPoints,
  fenceHeight: typedMap.site.perimeter.height,
};

export const plantZones: PlantZone[] = expandedZonesRaw.map((zone) => ({
  id: zone.id,
  name: zone.name,
  layer: zone.layer,
  polygon: zone.polygon.map((point) => recenter2(toTuple2(point))),
  color: zone.color,
  opacity: zone.opacity,
}));

export const defaultPlantMapObjects: PlantMapObject[] = expandedObjectsRaw.map((item) => ({
  id: item.id,
  name: item.name,
  type: item.type,
  modelKey: item.modelKey,
  layer: item.layer,
  zoneId: item.zoneId,
  position: recenter3(toTuple3(item.position)),
  rotation: toTuple3(item.rotation),
  scale: toTuple3(item.scale),
  modelUrl: item.modelUrl ? withBasePath(item.modelUrl) : undefined,
  assetType: item.assetType as AssetType | undefined,
  upAxis: item.upAxis,
  scaleMode: item.scaleMode,
  modelRotation: item.modelRotation ? toTuple3(item.modelRotation) : undefined,
  dimensions: item.dimensions ?? {},
  status: item.status ?? "ready",
  selectable: item.selectable ?? true,
}));

export const defaultPlantConnections: PlantMapConnection[] = expandedConnectionsRaw.map((connection) => ({
  id: connection.id,
  name: connection.name,
  type: connection.type,
  layer: connection.layer,
  fromObjectId: connection.fromObjectId,
  toObjectId: connection.toObjectId,
  points: connection.points.map((point) => recenter3(toTuple3(point))),
  diameter: connection.diameter,
  width: connection.width,
  status: connection.status ?? "ready",
  selectable: connection.selectable ?? true,
}));
