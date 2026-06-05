import { defenseAssetLibrary } from "@/shared/config/defense-asset-library";
import { getDefenseItemById } from "@/shared/config/defense-catalog";
import { defaultDefenseProjectLayers, defaultProtectedObject } from "@/shared/config/default-defense-layers";
import type {
  Coordinates,
  DefenseAssetCategory,
  DefenseAssetLibraryItem,
  DefenseProject,
  EditableDefenseLayer,
  DeleteLayerResult,
  LayerCost,
  LayerSummary,
  PlacedDefenseObject,
  PlacementValidationResult,
  ProjectCalculatorConfiguration,
} from "@/shared/types/defense-project";
import type { SelectedConfiguration } from "@/shared/types/defense-configuration";

const PROJECT_SCHEMA_VERSION = 1;

export type LayerRadii = {
  innerRadiusM: number;
  widthM: number;
  outerRadiusM: number;
};

export type LayerGeometryValidationResult = {
  isValid: boolean;
  level: "success" | "warning" | "error";
  message?: string;
  conflicts?: Array<{
    layerId: string;
    layerCode: string;
    layerName: string;
    innerRadiusM: number;
    outerRadiusM: number;
  }>;
};

export type LayerInsertOption =
  | {
      kind: "outside";
      label: string;
      minInnerRadiusM: number;
      maxOuterRadiusM: null;
      availableWidthM: number;
    }
  | {
      kind: "between";
      label: string;
      beforeLayerId: string;
      afterLayerId: string;
      minInnerRadiusM: number;
      maxOuterRadiusM: number;
      availableWidthM: number;
    }
  | {
      kind: "inside";
      label: string;
      minInnerRadiusM: number;
      maxOuterRadiusM: number;
      availableWidthM: number;
    };

export type AssetCatalogItem = {
  assetId: string;
  title: string;
  subtitle: string;
  category: DefenseAssetCategory;
  roles: DefenseAssetLibraryItem["roles"];
  pricePerUnitMln: number | null;
  score: number;
  priority: DefenseAssetLibraryItem["priority"];
  imageUrl: string;
  isRecommendedForActiveLayer: boolean;
  placedCount: number;
  maxQuantity: number;
  placementType: DefenseAssetLibraryItem["placementType"];
  tags: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function roundMln(value: number) {
  return Math.round(value * 10) / 10;
}

function isLayerVisible(layer: EditableDefenseLayer) {
  return layer.isVisible !== false;
}

function normalizeMeters(value: number | undefined, fallback: number) {
  return Math.max(0, Math.floor(Number.isFinite(value) ? Number(value) : fallback));
}

const fallbackAssetImageByCategory: Record<DefenseAssetCategory, string> = {
  "early-warning": "/drone-defense/echelons/l1/regional-mchs-center.png",
  detection: "/drone-defense/echelons/l2/radar-station.png",
  classification: "/drone-defense/echelons/l2/target-classification-software.png",
  jamming: "/drone-defense/echelons/placeholders/l4.svg",
  spoofing: "/drone-defense/echelons/placeholders/l4.svg",
  kinetic: "/drone-defense/echelons/placeholders/l6.svg",
  interceptor: "/drone-defense/echelons/placeholders/l5.svg",
  "passive-protection": "/drone-defense/echelons/placeholders/l8.svg",
  "engineering-protection": "/drone-defense/echelons/placeholders/l9.svg",
  infrastructure: "/drone-defense/echelons/placeholders/l9.svg",
  software: "/drone-defense/echelons/l2/target-classification-software.png",
  "command-center": "/drone-defense/echelons/l1/regional-operations-hq-fsb-curator.png",
  "external-service": "/drone-defense/echelons/l1/osint-monitoring-workstation.png",
};

function assetSubtitle(asset: DefenseAssetLibraryItem) {
  const roles = asset.roles.join(", ");
  const price = asset.pricePerUnitMln === null ? "без CAPEX" : `${asset.pricePerUnitMln} млн/${asset.unitLabel}`;
  return `${asset.shortName ?? asset.category} · ${roles} · ${price}`;
}

export function getAssetCatalogItems(
  project: DefenseProject,
  activeLayerCode: string | undefined,
  placedObjects: PlacedDefenseObject[] = project.placedObjects,
): AssetCatalogItem[] {
  return project.assetLibrary.map((asset) => {
    const legacyItem = getDefenseItemById(asset.id);
    const placedCount = placedObjects
      .filter((object) => object.assetId === asset.id)
      .reduce((acc, object) => acc + object.quantity, 0);
    const recommendedCodes = asset.recommendedLayerCodes ?? [];
    return {
      assetId: asset.id,
      title: asset.name,
      subtitle: assetSubtitle(asset),
      category: asset.category,
      roles: asset.roles,
      pricePerUnitMln: asset.pricePerUnitMln,
      score: asset.score ?? 0,
      priority: asset.priority,
      imageUrl: asset.iconUrl ?? fallbackAssetImageByCategory[asset.category],
      isRecommendedForActiveLayer: Boolean(activeLayerCode && recommendedCodes.includes(activeLayerCode)),
      placedCount,
      maxQuantity: legacyItem?.maxQuantity ?? 1,
      placementType: asset.placementType,
      tags: asset.tags ?? [],
    };
  });
}

export function getLayerRadii(layer: EditableDefenseLayer): LayerRadii {
  if (layer.geometry.type === "ring") {
    return {
      innerRadiusM: layer.geometry.minRadiusM,
      outerRadiusM: layer.geometry.maxRadiusM,
      widthM: Math.max(0, layer.geometry.maxRadiusM - layer.geometry.minRadiusM),
    };
  }
  if (layer.geometry.type === "circle") {
    return {
      innerRadiusM: 0,
      outerRadiusM: layer.geometry.radiusM,
      widthM: layer.geometry.radiusM,
    };
  }
  return {
    innerRadiusM: layer.distanceFromObjectMin ?? 0,
    outerRadiusM: layer.distanceFromObjectMax ?? 0,
    widthM: Math.max(0, (layer.distanceFromObjectMax ?? 0) - (layer.distanceFromObjectMin ?? 0)),
  };
}

function layerRadii(layer: EditableDefenseLayer) {
  return getLayerRadii(layer);
}

function layersOverlap(first: LayerRadii, second: LayerRadii) {
  return first.innerRadiusM < second.outerRadiusM && first.outerRadiusM > second.innerRadiusM;
}

export function validateLayerGeometry(
  project: DefenseProject,
  draftLayer: EditableDefenseLayer,
  ignoredLayerId?: string,
): LayerGeometryValidationResult {
  const radii = getLayerRadii(draftLayer);
  if (radii.innerRadiusM < 0) {
    return {
      isValid: false,
      level: "error",
      message: "Внутренний радиус должен быть больше или равен 0.",
    };
  }
  if (radii.widthM <= 0 || radii.outerRadiusM <= radii.innerRadiusM) {
    return {
      isValid: false,
      level: "error",
      message: "Ширина эшелона должна быть больше 0.",
    };
  }

  const conflicts = project.layers
    .filter((layer) => layer.id !== ignoredLayerId && layer.id !== draftLayer.id)
    .map((layer) => ({ layer, radii: getLayerRadii(layer) }))
    .filter((item) => layersOverlap(radii, item.radii))
    .map((item) => ({
      layerId: item.layer.id,
      layerCode: item.layer.code,
      layerName: item.layer.name,
      innerRadiusM: item.radii.innerRadiusM,
      outerRadiusM: item.radii.outerRadiusM,
    }));

  if (conflicts.length > 0) {
    return {
      isValid: false,
      level: "error",
      message: `Диапазон пересекается с эшелоном ${conflicts.map((item) => item.layerCode).join(", ")}.`,
      conflicts,
    };
  }

  return { isValid: true, level: "success" };
}

export function findLayerInsertOptions(project: DefenseProject): LayerInsertOption[] {
  const ordered = [...project.layers]
    .map((layer) => ({ layer, radii: getLayerRadii(layer) }))
    .sort((a, b) => b.radii.outerRadiusM - a.radii.outerRadiusM);

  if (ordered.length === 0) {
    return [
      {
        kind: "outside",
        label: "Снаружи",
        minInnerRadiusM: 0,
        maxOuterRadiusM: null,
        availableWidthM: Number.POSITIVE_INFINITY,
      },
    ];
  }

  const outermost = ordered[0];
  const innermost = ordered.reduce((current, item) =>
    item.radii.innerRadiusM < current.radii.innerRadiusM ? item : current,
  );
  const options: LayerInsertOption[] = [
    {
      kind: "outside",
      label: `Снаружи ${outermost.layer.code}`,
      minInnerRadiusM: outermost.radii.outerRadiusM,
      maxOuterRadiusM: null,
      availableWidthM: Number.POSITIVE_INFINITY,
    },
  ];

  for (let index = 0; index < ordered.length - 1; index += 1) {
    const before = ordered[index];
    const after = ordered[index + 1];
    const minInnerRadiusM = after.radii.outerRadiusM;
    const maxOuterRadiusM = before.radii.innerRadiusM;
    options.push({
      kind: "between",
      label: `Между ${before.layer.code} и ${after.layer.code}`,
      beforeLayerId: before.layer.id,
      afterLayerId: after.layer.id,
      minInnerRadiusM,
      maxOuterRadiusM,
      availableWidthM: Math.max(0, maxOuterRadiusM - minInnerRadiusM),
    });
  }

  options.push({
    kind: "inside",
    label: `Внутри ${innermost.layer.code}`,
    minInnerRadiusM: 0,
    maxOuterRadiusM: innermost.radii.innerRadiusM,
    availableWidthM: Math.max(0, innermost.radii.innerRadiusM),
  });

  return options;
}

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const earthRadiusM = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const haversine =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earthRadiusM * Math.asin(Math.sqrt(haversine));
}

function pointInPolygon(point: Coordinates, polygon: Coordinates[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function createDefaultDefenseProject(): DefenseProject {
  const activeLayerId = defaultDefenseProjectLayers.find((layer) => layer.isActive)?.id ?? defaultDefenseProjectLayers[0]?.id;
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: "current",
    projectName: "Моя конфигурация",
    baseObject: defaultProtectedObject,
    layers: defaultDefenseProjectLayers.map((layer) => ({ ...layer, geometry: { ...layer.geometry } })),
    assetLibrary: defenseAssetLibrary,
    placedObjects: [],
    activeLayerId,
    mode: "view",
    source: "custom",
    updatedAt: nowIso(),
  };
}

export function recenterProject(project: DefenseProject, center: Coordinates): DefenseProject {
  const recenteredLayers = project.layers.map((layer) => {
    if (layer.geometry.type === "ring" || layer.geometry.type === "circle") {
      return {
        ...layer,
        geometry: {
          ...layer.geometry,
          center,
        },
      };
    }
    return layer;
  });

  return withUpdatedAt({
    ...project,
    baseObject: {
      ...project.baseObject,
      center,
    },
    layers: recenteredLayers,
  });
}

export function updateLayerGeometryFromRadii(
  layer: EditableDefenseLayer,
  radii: { innerRadiusM?: number; widthM?: number; center?: Coordinates },
): EditableDefenseLayer {
  const current = layerRadii(layer);
  const innerRadiusM = normalizeMeters(radii.innerRadiusM, current.innerRadiusM);
  const widthM = Math.max(1, normalizeMeters(radii.widthM, current.widthM || 1000));
  const maxRadiusM = innerRadiusM + widthM;
  const center = radii.center ?? (layer.geometry.type === "ring" || layer.geometry.type === "circle" ? layer.geometry.center : undefined);

  return {
    ...layer,
    distanceFromObjectMin: innerRadiusM,
    distanceFromObjectMax: maxRadiusM,
    geometryType: "ring",
    geometry: {
      type: "ring",
      center: center ?? { lat: 0, lng: 0 },
      minRadiusM: innerRadiusM,
      maxRadiusM,
    },
  };
}

export function createRingLayer(
  project: DefenseProject,
  data: Partial<EditableDefenseLayer> & { innerRadiusM?: number; widthM?: number } = {},
): EditableDefenseLayer {
  const order = data.order ?? project.layers.length + 1;
  const innerRadiusM = normalizeMeters(data.innerRadiusM ?? data.distanceFromObjectMin, 1000 * order);
  const widthM = Math.max(1, normalizeMeters(data.widthM, 5000));
  const layer: EditableDefenseLayer = {
    id: data.id ?? uniqueId("layer"),
    name: data.name ?? "Новый эшелон",
    code: data.code ?? `L${order}`,
    description: data.description,
    order,
    distanceFromObjectMin: innerRadiusM,
    distanceFromObjectMax: innerRadiusM + widthM,
    geometryType: "ring",
    geometry: {
      type: "ring",
      center: project.baseObject.center,
      minRadiusM: innerRadiusM,
      maxRadiusM: innerRadiusM + widthM,
    },
    color: data.color ?? "#2563eb",
    opacity: data.opacity ?? 0.16,
    isActive: data.isActive ?? false,
    isVisible: data.isVisible ?? true,
    isLocked: data.isLocked ?? false,
  };

  return data.geometry?.type === "ring" ? { ...layer, geometry: data.geometry, geometryType: "ring" } : layer;
}

export function isPointInsideLayerGeometry(layer: EditableDefenseLayer, coordinates: Coordinates): boolean {
  const geometry = layer.geometry;
  if (geometry.type === "circle") {
    return distanceMeters(geometry.center, coordinates) <= geometry.radiusM;
  }
  if (geometry.type === "ring") {
    const distance = distanceMeters(geometry.center, coordinates);
    return distance >= geometry.minRadiusM && distance <= geometry.maxRadiusM;
  }
  if (geometry.type === "polygon" || geometry.type === "freeform") {
    return geometry.points.length >= 3 ? pointInPolygon(coordinates, geometry.points) : false;
  }
  return false;
}

export function validateObjectPlacement(
  project: DefenseProject,
  assetId: string | undefined,
  layerId: string | undefined,
  coordinates: Coordinates,
): PlacementValidationResult {
  if (!layerId) return { isValid: false, level: "error", message: "Выберите эшелон" };
  if (!assetId) return { isValid: false, level: "error", message: "Выберите средство защиты" };

  const layer = project.layers.find((item) => item.id === layerId);
  if (!layer) return { isValid: false, level: "error", message: "Эшелон не найден" };
  if (layer.isLocked) return { isValid: false, level: "error", message: "Эшелон заблокирован для размещения." };
  const asset = project.assetLibrary.find((item) => item.id === assetId);
  if (!asset) return { isValid: false, level: "error", message: "Средство защиты не найдено" };

  if (asset.placementType !== "non-physical" && !isPointInsideLayerGeometry(layer, coordinates)) {
    return {
      isValid: false,
      level: "error",
      message: "Нельзя разместить объект вне границ выбранного эшелона.",
    };
  }

  const warning =
    asset.recommendedLayerCodes?.length && !asset.recommendedLayerCodes.includes(layer.code)
      ? "Это средство можно разместить в выбранном эшелоне, но оно не является рекомендованным для данной зоны."
      : undefined;

  return warning
    ? { isValid: true, level: "warning", message: warning }
    : { isValid: true, level: "success" };
}

export function createPlacedObject(
  project: DefenseProject,
  assetId: string,
  layerId: string,
  coordinates: Coordinates,
  patch: Partial<PlacedDefenseObject> = {},
): PlacedDefenseObject {
  const asset = project.assetLibrary.find((item) => item.id === assetId);
  const timestamp = nowIso();
  return {
    id: patch.id ?? uniqueId("placed"),
    assetId,
    layerId,
    name: patch.name ?? asset?.name,
    coordinates,
    rotation: patch.rotation,
    scale: patch.scale,
    quantity: Math.max(1, Math.floor(patch.quantity ?? 1)),
    status: patch.status ?? "planned",
    customPricePerUnitMln: patch.customPricePerUnitMln,
    customCoverageRadius: patch.customCoverageRadius,
    notes: patch.notes,
    createdAt: patch.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

function withUpdatedAt(project: DefenseProject): DefenseProject {
  return { ...project, updatedAt: nowIso() };
}

export function placeObjectInProject(
  project: DefenseProject,
  assetId: string,
  layerId: string,
  coordinates: Coordinates,
  patch: Partial<PlacedDefenseObject> = {},
): DefenseProject {
  const validation = validateObjectPlacement(project, assetId, layerId, coordinates);
  if (!validation.isValid) return project;
  const object = createPlacedObject(project, assetId, layerId, coordinates, patch);
  return withUpdatedAt({
    ...project,
    placedObjects: [...project.placedObjects, object],
    selectedObjectId: object.id,
    selectedAssetId: assetId,
    activeLayerId: layerId,
    mode: "view",
    source: project.source === "preset" ? "custom" : project.source,
  });
}

export function movePlacedObjectInProject(project: DefenseProject, objectId: string, coordinates: Coordinates): DefenseProject {
  const object = project.placedObjects.find((item) => item.id === objectId);
  if (!object) return project;
  const validation = validateObjectPlacement(project, object.assetId, object.layerId, coordinates);
  if (!validation.isValid) return project;
  return withUpdatedAt({
    ...project,
    placedObjects: project.placedObjects.map((item) =>
      item.id === objectId ? { ...item, coordinates, updatedAt: nowIso() } : item,
    ),
  });
}

export function transferPlacedObjectToLayerInProject(
  project: DefenseProject,
  objectId: string,
  layerId: string,
): { project: DefenseProject; validation: PlacementValidationResult } {
  const object = project.placedObjects.find((item) => item.id === objectId);
  if (!object) {
    return {
      project,
      validation: { isValid: false, level: "error", message: "Объект не найден" },
    };
  }

  const validation = validateObjectPlacement(project, object.assetId, layerId, object.coordinates);
  if (!validation.isValid) return { project, validation };

  return {
    project: withUpdatedAt({
      ...project,
      activeLayerId: layerId,
      selectedObjectId: objectId,
      placedObjects: project.placedObjects.map((item) =>
        item.id === objectId ? { ...item, layerId, updatedAt: nowIso() } : item,
      ),
      source: project.source === "preset" ? "custom" : project.source,
    }),
    validation,
  };
}

export function updatePlacedObjectInProject(
  project: DefenseProject,
  objectId: string,
  patch: Partial<PlacedDefenseObject>,
): DefenseProject {
  return withUpdatedAt({
    ...project,
    placedObjects: project.placedObjects.map((item) =>
      item.id === objectId
        ? {
            ...item,
            ...patch,
            quantity: patch.quantity === undefined ? item.quantity : Math.max(1, Math.floor(patch.quantity)),
            updatedAt: nowIso(),
          }
        : item,
    ),
  });
}

export function deletePlacedObjectInProject(project: DefenseProject, objectId: string): DefenseProject {
  return withUpdatedAt({
    ...project,
    placedObjects: project.placedObjects.filter((item) => item.id !== objectId),
    selectedObjectId: project.selectedObjectId === objectId ? undefined : project.selectedObjectId,
  });
}

export function deleteLayerFromProject(project: DefenseProject, layerId: string): DeleteLayerResult {
  const layer = project.layers.find((item) => item.id === layerId);
  if (!layer) {
    return { ok: false, reason: "layer-not-found", message: "Эшелон не найден." };
  }
  if (project.layers.length <= 1) {
    return { ok: false, reason: "last-layer", message: "Нельзя удалить последний эшелон проекта." };
  }
  if (layer.isLocked) {
    return { ok: false, reason: "layer-locked", message: "Эшелон заблокирован. Сначала снимите блокировку." };
  }
  if (project.placedObjects.some((object) => object.layerId === layerId)) {
    return {
      ok: false,
      reason: "layer-has-objects",
      message: "В эшелоне есть размещённые объекты. Сначала удалите или перенесите их.",
    };
  }
  const layers = project.layers
    .filter((item) => item.id !== layerId)
    .map((item, index) => ({ ...item, order: index + 1, isActive: project.activeLayerId === layerId ? index === 0 : item.id === project.activeLayerId }));
  return {
    ok: true,
    project: withUpdatedAt({
      ...project,
      layers,
      activeLayerId: project.activeLayerId === layerId ? layers[0]?.id : project.activeLayerId,
    }),
  };
}

export function canEditLayer(project: DefenseProject, layerId: string): boolean {
  const layer = project.layers.find((item) => item.id === layerId);
  return Boolean(layer && !layer.isLocked);
}

export function updateLayerOrder(project: DefenseProject, layerId: string, direction: "up" | "down"): DefenseProject {
  const ordered = [...project.layers].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((layer) => layer.id === layerId);
  if (index < 0) return project;
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= ordered.length) return project;
  const next = [...ordered];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return withUpdatedAt({
    ...project,
    layers: next.map((layer, nextIndex) => ({ ...layer, order: nextIndex + 1 })),
  });
}

export function duplicatePlacedObjectInProject(project: DefenseProject, objectId: string): DefenseProject {
  const object = project.placedObjects.find((item) => item.id === objectId);
  if (!object) return project;
  const copy = {
    ...object,
    id: uniqueId("placed"),
    name: object.name ? `${object.name} копия` : undefined,
    coordinates: { ...object.coordinates, lat: object.coordinates.lat + 0.001, lng: object.coordinates.lng + 0.001 },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  return withUpdatedAt({
    ...project,
    placedObjects: [...project.placedObjects, copy],
    selectedObjectId: copy.id,
  });
}

function layerForAsset(project: DefenseProject, assetId: string): EditableDefenseLayer {
  const asset = project.assetLibrary.find((item) => item.id === assetId);
  return project.layers.find((layer) => layer.code === asset?.recommendedLayerCodes?.[0]) ?? project.layers[0];
}

function coordinatesForIndex(project: DefenseProject, index: number): Coordinates {
  return {
    lat: project.baseObject.center.lat + 0.001 * (index + 1),
    lng: project.baseObject.center.lng + 0.001 * (index + 1),
  };
}

export function setAssetQuantityInProject(project: DefenseProject, assetId: string, quantity: number): DefenseProject {
  const normalized = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  const currentObjects = project.placedObjects.filter((object) => object.assetId === assetId);
  const otherObjects = project.placedObjects.filter((object) => object.assetId !== assetId);
  const currentUnits = currentObjects.reduce((acc, object) => acc + object.quantity, 0);
  if (normalized === currentUnits) return project;
  if (normalized === 0) {
    return withUpdatedAt({ ...project, placedObjects: otherObjects });
  }

  const layer = layerForAsset(project, assetId);
  const nextObjects: PlacedDefenseObject[] = [];
  for (let index = 0; index < normalized; index += 1) {
    nextObjects.push(
      currentObjects[index] ??
        createPlacedObject(project, assetId, layer.id, coordinatesForIndex(project, index), {
          quantity: 1,
        }),
    );
  }

  return withUpdatedAt({
    ...project,
    placedObjects: [...otherObjects, ...nextObjects],
    activeLayerId: layer.id,
    selectedAssetId: assetId,
  });
}

export function priceForPlacedObject(project: DefenseProject, object: PlacedDefenseObject): number {
  const asset = project.assetLibrary.find((item) => item.id === object.assetId);
  return object.customPricePerUnitMln ?? asset?.pricePerUnitMln ?? 0;
}

export function calculateProjectTotalCost(project: DefenseProject): number {
  return roundMln(
    project.placedObjects.reduce((acc, object) => acc + priceForPlacedObject(project, object) * object.quantity, 0),
  );
}

export function calculateProjectTotalUnits(project: DefenseProject): number {
  return project.placedObjects.reduce((acc, object) => acc + object.quantity, 0);
}

export function calculateProjectTotalObjects(project: DefenseProject): number {
  return project.placedObjects.length;
}

export function calculateCostByLayer(project: DefenseProject): LayerCost[] {
  return project.layers.map((layer) => ({
    layerId: layer.id,
    layerName: layer.name,
    totalMln: roundMln(
      project.placedObjects
        .filter((object) => object.layerId === layer.id)
        .reduce((acc, object) => acc + priceForPlacedObject(project, object) * object.quantity, 0),
    ),
  }));
}

export function calculateLayerConflicts(project: DefenseProject, layerId?: string): PlacedDefenseObject[] {
  return project.placedObjects.filter((object) => {
    if (layerId && object.layerId !== layerId) return false;
    const layer = project.layers.find((item) => item.id === object.layerId);
    const asset = project.assetLibrary.find((item) => item.id === object.assetId);
    if (!layer || !asset || asset.placementType === "non-physical") return false;
    return !isPointInsideLayerGeometry(layer, object.coordinates);
  });
}

export function calculateLayerSummaries(project: DefenseProject): LayerSummary[] {
  return [...project.layers]
    .sort((a, b) => a.order - b.order)
    .map((layer) => {
      const objects = project.placedObjects.filter((object) => object.layerId === layer.id);
      const radii = layerRadii(layer);
      const conflictCount = calculateLayerConflicts(project, layer.id).length;
      return {
        layerId: layer.id,
        layerCode: layer.code,
        layerName: layer.name,
        objectCount: objects.length,
        unitCount: objects.reduce((acc, object) => acc + object.quantity, 0),
        totalMln: roundMln(objects.reduce((acc, object) => acc + priceForPlacedObject(project, object) * object.quantity, 0)),
        coverageScore: Math.round(
          objects.reduce((acc, object) => {
            const asset = project.assetLibrary.find((item) => item.id === object.assetId);
            return acc + (asset?.score ?? 0) * object.quantity;
          }, 0),
        ),
        conflictCount,
        innerRadiusM: radii.innerRadiusM,
        widthM: radii.widthM,
        outerRadiusM: radii.outerRadiusM,
      };
    });
}

function assetToCalculatorAssetId(asset: DefenseAssetLibraryItem): string {
  return asset.calculatorAssetId ?? asset.id;
}

export function projectToCalculatorConfiguration(project: DefenseProject): ProjectCalculatorConfiguration {
  const quantities = new Map<string, number>();
  project.placedObjects.forEach((object) => {
    const asset = project.assetLibrary.find((item) => item.id === object.assetId);
    if (!asset) return;
    const assetId = assetToCalculatorAssetId(asset);
    quantities.set(assetId, (quantities.get(assetId) ?? 0) + object.quantity);
  });
  return {
    id: project.projectId,
    name: project.projectName,
    lines: [...quantities.entries()].map(([assetId, quantity]) => ({ assetId, quantity })),
  };
}

export function legacySelectedConfigurationToProject(configuration: SelectedConfiguration): DefenseProject {
  let project = createDefaultDefenseProject();
  project = {
    ...project,
    projectName: configuration.name,
    source: "legacy-migration",
    basePresetId: configuration.basePresetId,
  };
  Object.entries(configuration.selectedItems).forEach(([assetId, quantity]) => {
    project = setAssetQuantityInProject(project, assetId, quantity);
  });
  return project;
}

export function exportDefenseProjectJson(project: DefenseProject): string {
  return JSON.stringify({ ...project, updatedAt: nowIso() }, null, 2);
}

export function importDefenseProjectJson(raw: string): DefenseProject {
  const parsed = JSON.parse(raw) as DefenseProject;
  if (parsed.schemaVersion !== PROJECT_SCHEMA_VERSION || !Array.isArray(parsed.layers) || !Array.isArray(parsed.placedObjects)) {
    throw new Error("Invalid defense project JSON");
  }
  return {
    ...parsed,
    layers: parsed.layers.map((layer) => ({ ...layer, isVisible: isLayerVisible(layer) })),
  };
}
