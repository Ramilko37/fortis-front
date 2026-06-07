import { defenseAssetLibrary } from "@/shared/config/defense-asset-library";
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

export type PlacedObjectConflictFlags = Pick<
  PlacedDefenseObject,
  "hasGeometryConflict" | "hasCoverageConflict" | "hasTerrainConflict"
>;

export type AssetCatalogItem = {
  assetId: string;
  title: string;
  subtitle: string;
  category: DefenseAssetCategory;
  categoryLabel: string;
  roles: DefenseAssetLibraryItem["roles"];
  pricePerUnitMln: number | null;
  priceLabel: string;
  rangeLabel: string;
  coverageType: DefenseAssetLibraryItem["coverageType"];
  coverageTypeLabel: string;
  coverageLabel: string;
  score: number;
  priority: DefenseAssetLibraryItem["priority"];
  imageUrl: string;
  isRecommendedForActiveLayer: boolean;
  compatibilityStatus: "recommended" | "compatible" | "warning" | "incompatible";
  compatibilityLabel: string;
  canPlaceInActiveLayer: boolean;
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

const categoryLabels: Record<DefenseAssetCategory, string> = {
  "early-warning": "Раннее предупреждение",
  detection: "Обнаружение",
  classification: "Классификация",
  jamming: "Подавление",
  spoofing: "Спуфинг",
  kinetic: "Поражение",
  interceptor: "Перехват",
  "passive-protection": "Пассивная защита",
  "engineering-protection": "Инженерная защита",
  infrastructure: "Инфраструктура",
  software: "ПО/аналитика",
  "command-center": "Командный центр",
  "external-service": "Внешний сервис",
};

const coverageTypeLabels: Record<DefenseAssetLibraryItem["coverageType"], string> = {
  circle: "Круговое покрытие",
  sector: "Секторное покрытие",
  line: "Линейное покрытие",
  polygon: "Зональное покрытие",
  none: "Без покрытия на карте",
};

function formatAssetDistance(meters: number | undefined) {
  if (meters === undefined) return null;
  if (meters >= 1000) return `${(meters / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;
  return `${meters.toLocaleString("ru-RU")} м`;
}

function assetRangeLabel(asset: DefenseAssetLibraryItem) {
  const min = formatAssetDistance(asset.minEffectiveDistance);
  const max = formatAssetDistance(asset.maxEffectiveDistance ?? asset.coverageRadius);
  if (min && max) return `${min}-${max}`;
  if (max) return `до ${max}`;
  if (asset.placementType === "non-physical") return "точка на карте";
  return "зона задаётся на карте";
}

function assetPriceLabel(asset: DefenseAssetLibraryItem) {
  return asset.pricePerUnitMln === null
    ? "без CAPEX"
    : `${asset.pricePerUnitMln.toLocaleString("ru-RU")} млн ₽/${asset.unitLabel}`;
}

function assetCoverageLabel(asset: DefenseAssetLibraryItem) {
  const radius = formatAssetDistance(asset.coverageRadius);
  const typeLabel = coverageTypeLabels[asset.coverageType];
  if (radius && asset.coverageAngle) return `${typeLabel}: ${radius}, ${asset.coverageAngle}°`;
  if (radius) return `${typeLabel}: радиус ${radius}`;
  if (asset.placementType === "zone-object") return `${typeLabel}: зона`;
  if (asset.placementType === "non-physical") return typeLabel;
  return `${typeLabel}: точка`;
}

function assetCompatibility(
  asset: DefenseAssetLibraryItem,
  activeLayerCode: string | undefined,
): Pick<AssetCatalogItem, "compatibilityStatus" | "compatibilityLabel" | "canPlaceInActiveLayer" | "isRecommendedForActiveLayer"> {
  const isRecommendedForActiveLayer = Boolean(activeLayerCode && asset.recommendedLayerCodes?.includes(activeLayerCode));

  return {
    compatibilityStatus: isRecommendedForActiveLayer ? "recommended" : "compatible",
    compatibilityLabel: "",
    canPlaceInActiveLayer: true,
    isRecommendedForActiveLayer,
  };
}

export function getAssetCatalogItems(
  project: DefenseProject,
  activeLayerCode: string | undefined,
  placedObjects: PlacedDefenseObject[] = project.placedObjects,
): AssetCatalogItem[] {
  return project.assetLibrary.map((asset) => {
    const placedCount = placedObjects
      .filter((object) => object.assetId === asset.id)
      .reduce((acc, object) => acc + object.quantity, 0);
    const compatibility = assetCompatibility(asset, activeLayerCode);
    return {
      assetId: asset.id,
      title: asset.name,
      subtitle: assetSubtitle(asset),
      category: asset.category,
      categoryLabel: categoryLabels[asset.category],
      roles: asset.roles,
      pricePerUnitMln: asset.pricePerUnitMln,
      priceLabel: assetPriceLabel(asset),
      rangeLabel: assetRangeLabel(asset),
      coverageType: asset.coverageType,
      coverageTypeLabel: coverageTypeLabels[asset.coverageType],
      coverageLabel: assetCoverageLabel(asset),
      score: asset.score ?? 0,
      priority: asset.priority,
      imageUrl: asset.iconUrl ?? fallbackAssetImageByCategory[asset.category],
      ...compatibility,
      placedCount,
      maxQuantity: 0,
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
  void coordinates;
  if (!layerId) return { isValid: false, level: "error", message: "Выберите эшелон" };
  if (!assetId) return { isValid: false, level: "error", message: "Выберите средство защиты" };

  const layer = project.layers.find((item) => item.id === layerId);
  if (!layer) return { isValid: false, level: "error", message: "Эшелон не найден" };
  const asset = project.assetLibrary.find((item) => item.id === assetId);
  if (!asset) return { isValid: false, level: "error", message: "Средство защиты не найдено" };

  return { isValid: true, level: "success" };
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
    customCoverageAngle: patch.customCoverageAngle,
    hasGeometryConflict: false,
    hasCoverageConflict: false,
    hasTerrainConflict: false,
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
  return withUpdatedAt(syncPlacedObjectConflictFlags({
    ...project,
    placedObjects: [...project.placedObjects, object],
    selectedObjectId: object.id,
    selectedAssetId: assetId,
    activeLayerId: layerId,
    mode: "view",
    source: project.source === "preset" ? "custom" : project.source,
  }));
}

export function movePlacedObjectInProject(project: DefenseProject, objectId: string, coordinates: Coordinates): DefenseProject {
  const object = project.placedObjects.find((item) => item.id === objectId);
  if (!object) return project;
  const validation = validateObjectPlacement(project, object.assetId, object.layerId, coordinates);
  if (!validation.isValid) return project;
  return withUpdatedAt(syncPlacedObjectConflictFlags({
    ...project,
    placedObjects: project.placedObjects.map((item) =>
      item.id === objectId ? { ...item, coordinates, updatedAt: nowIso() } : item,
    ),
  }));
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
    project: withUpdatedAt(syncPlacedObjectConflictFlags({
      ...project,
      activeLayerId: layerId,
      selectedObjectId: objectId,
      placedObjects: project.placedObjects.map((item) =>
        item.id === objectId ? { ...item, layerId, updatedAt: nowIso() } : item,
      ),
      source: project.source === "preset" ? "custom" : project.source,
    })),
    validation,
  };
}

export function updatePlacedObjectInProject(
  project: DefenseProject,
  objectId: string,
  patch: Partial<PlacedDefenseObject>,
): DefenseProject {
  return withUpdatedAt(syncPlacedObjectConflictFlags({
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
  }));
}

export function deletePlacedObjectInProject(project: DefenseProject, objectId: string): DefenseProject {
  return withUpdatedAt(syncPlacedObjectConflictFlags({
    ...project,
    placedObjects: project.placedObjects.filter((item) => item.id !== objectId),
    selectedObjectId: project.selectedObjectId === objectId ? undefined : project.selectedObjectId,
  }));
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
  return withUpdatedAt(syncPlacedObjectConflictFlags({
    ...project,
    placedObjects: [...project.placedObjects, copy],
    selectedObjectId: copy.id,
  }));
}

function layerForAsset(project: DefenseProject, assetId: string): EditableDefenseLayer {
  const asset = project.assetLibrary.find((item) => item.id === assetId);
  return (
    project.layers.find((layer) => layer.code === asset?.recommendedLayerCodes?.[0]) ??
    project.layers.find((layer) => layer.code === asset?.compatibleLayerCodes?.[0]) ??
    project.layers[0]
  );
}

function coordinatesForDraftObject(project: DefenseProject, layer: EditableDefenseLayer, index: number): Coordinates {
  const center =
    layer.geometry.type === "ring" || layer.geometry.type === "circle"
      ? layer.geometry.center
      : project.baseObject.center;
  const radii = getLayerRadii(layer);
  const radiusM =
    radii.outerRadiusM > radii.innerRadiusM
      ? radii.innerRadiusM + Math.max(250, (radii.outerRadiusM - radii.innerRadiusM) / 2)
      : Math.max(500, radii.outerRadiusM || 1000);
  const angleRad = ((index * 47 + 23) * Math.PI) / 180;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = Math.max(1, metersPerDegreeLat * Math.cos((center.lat * Math.PI) / 180));
  return {
    lat: center.lat + (Math.sin(angleRad) * radiusM) / metersPerDegreeLat,
    lng: center.lng + (Math.cos(angleRad) * radiusM) / metersPerDegreeLng,
  };
}

function assetIdForProjectLine(project: DefenseProject, assetId: string) {
  return project.assetLibrary.find((asset) => asset.id === assetId || asset.calculatorAssetId === assetId)?.id ?? assetId;
}

export function getPlacedObjectConflictFlags(
  project: DefenseProject,
  object: PlacedDefenseObject,
): PlacedObjectConflictFlags {
  void project;
  void object;
  return {
    hasGeometryConflict: false,
    hasCoverageConflict: false,
    hasTerrainConflict: false,
  };
}

export function syncPlacedObjectConflictFlags(project: DefenseProject): DefenseProject {
  return {
    ...project,
    placedObjects: project.placedObjects.map((object) => ({
      ...object,
      ...getPlacedObjectConflictFlags(project, object),
    })),
  };
}

export function applyAssetQuantityDraftsToProject(
  project: DefenseProject,
  lines: Array<{ assetId: string; quantity: number }>,
): DefenseProject {
  const draftBase = { ...project, placedObjects: [] };
  const placedObjects: PlacedDefenseObject[] = [];
  lines.forEach((line, index) => {
    const normalizedQuantity = Math.max(0, Math.floor(Number.isFinite(line.quantity) ? line.quantity : 0));
    if (normalizedQuantity <= 0) return;
    const projectAssetId = assetIdForProjectLine(draftBase, line.assetId);
    const layer = layerForAsset(draftBase, projectAssetId);
    placedObjects.push(
      createPlacedObject(draftBase, projectAssetId, layer.id, coordinatesForDraftObject(draftBase, layer, index), {
        quantity: normalizedQuantity,
        status: "planned",
      }),
    );
  });

  return withUpdatedAt(syncPlacedObjectConflictFlags({
    ...draftBase,
    placedObjects,
    activeLayerId: placedObjects[0]?.layerId ?? draftBase.activeLayerId,
    selectedAssetId: placedObjects[0]?.assetId ?? draftBase.selectedAssetId,
    selectedObjectId: placedObjects[0]?.id,
    source: draftBase.source === "preset" ? "custom" : draftBase.source,
  }));
}

export function setAssetQuantityInProject(project: DefenseProject, assetId: string, quantity: number): DefenseProject {
  const normalized = Math.max(0, Math.floor(Number.isFinite(quantity) ? quantity : 0));
  const lineByAsset = new Map<string, number>();
  project.placedObjects
    .filter((object) => object.assetId !== assetId)
    .forEach((object) => lineByAsset.set(object.assetId, (lineByAsset.get(object.assetId) ?? 0) + object.quantity));
  if (normalized > 0) lineByAsset.set(assetId, normalized);
  return applyAssetQuantityDraftsToProject(
    project,
    [...lineByAsset.entries()].map(([lineAssetId, lineQuantity]) => ({ assetId: lineAssetId, quantity: lineQuantity })),
  );
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
  void project;
  void layerId;
  return [];
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

function normalizeProjectAssetLibrary(assetLibrary: DefenseProject["assetLibrary"]): DefenseProject["assetLibrary"] {
  const importedById = new Map((assetLibrary ?? []).map((asset) => [asset.id, asset]));
  const canonicalIds = new Set(defenseAssetLibrary.map((asset) => asset.id));
  const canonicalAssets = defenseAssetLibrary.map((asset) => ({
    ...(importedById.get(asset.id) ?? {}),
    ...asset,
  }));
  const customAssets = (assetLibrary ?? [])
    .filter((asset) => !canonicalIds.has(asset.id))
    .map((asset) => ({
      ...asset,
      coverageType: asset.coverageType ?? "none",
      currency: asset.currency ?? "RUB",
      roles: asset.roles ?? [],
      pricePerUnitMln: asset.pricePerUnitMln ?? null,
      unitLabel: asset.unitLabel ?? "шт",
      deploymentType: asset.deploymentType ?? "external",
      placementType: asset.placementType ?? "non-physical",
    }));
  return [...canonicalAssets, ...customAssets];
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
  return applyAssetQuantityDraftsToProject(
    project,
    Object.entries(configuration.selectedItems).map(([assetId, quantity]) => ({ assetId, quantity })),
  );
}

export function exportDefenseProjectJson(project: DefenseProject): string {
  return JSON.stringify({ ...project, updatedAt: nowIso() }, null, 2);
}

export function importDefenseProjectJson(raw: string): DefenseProject {
  const parsed = JSON.parse(raw) as DefenseProject;
  if (parsed.schemaVersion !== PROJECT_SCHEMA_VERSION || !Array.isArray(parsed.layers) || !Array.isArray(parsed.placedObjects)) {
    throw new Error("Invalid defense project JSON");
  }
  return syncPlacedObjectConflictFlags({
    ...parsed,
    assetLibrary: normalizeProjectAssetLibrary(parsed.assetLibrary),
    layers: parsed.layers.map((layer) => ({ ...layer, isVisible: isLayerVisible(layer) })),
  });
}
