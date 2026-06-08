import type {
  DefenseCatalogResponse,
  DefenseLayer,
  DefenseLayerId,
  Placement,
} from "@/shared/types/drone-defense";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";

export type PlacementStatus = "ready" | "warning" | "inactive";

export type PlacementSummary = {
  id: string;
  name: string;
  echelonShortName: string;
  echelonName: string;
  qty: number;
  status: PlacementStatus;
  costRub: number;
};

export const READINESS_WARNING_THRESHOLD = 0.4;
export const READINESS_INACTIVE_THRESHOLD = 0.05;

export function placementStatus(readiness: number): PlacementStatus {
  if (readiness <= READINESS_INACTIVE_THRESHOLD) return "inactive";
  if (readiness < READINESS_WARNING_THRESHOLD) return "warning";
  return "ready";
}

export function describePlacement({
  placement,
  catalog,
  layers,
}: {
  placement: Placement;
  catalog: DefenseCatalogResponse | null;
  layers: DefenseLayer[];
}): PlacementSummary {
  const asset = catalog?.assets.find((item) => item.id === placement.assetId) ?? null;
  const layer = layers.find((item) => item.id === placement.layerId) ?? null;
  const unitCost = asset?.cost.capexRub ?? 0;
  return {
    id: placement.id,
    name: placement.catalogGroupName ?? asset?.name ?? placement.assetId,
    echelonShortName: layer?.shortName ?? "—",
    echelonName: layer?.name ?? "Без эшелона",
    qty: placement.qty,
    status: placementStatus(placement.readiness),
    costRub: unitCost * placement.qty,
  };
}

export type MarkerState = "default" | "hover" | "selected" | "warning" | "conflict" | "inactive";

export function getMarkerState({
  placement,
  selectedPlacementId,
  hoveredPlacementId,
  isDuplicateInSlot,
}: {
  placement: Placement;
  selectedPlacementId: string | null;
  hoveredPlacementId: string | null;
  isDuplicateInSlot: boolean;
}): MarkerState {
  if (placement.id === selectedPlacementId) return "selected";
  if (isDuplicateInSlot) return "conflict";
  if (placement.readiness <= READINESS_INACTIVE_THRESHOLD) return "inactive";
  if (placement.readiness < READINESS_WARNING_THRESHOLD) return "warning";
  if (placement.id === hoveredPlacementId) return "hover";
  return "default";
}

// --- Coverage shape helpers ---

export type CoverageShape =
  | { kind: "none" }
  | { kind: "circle"; radiusM: number }
  | { kind: "sector"; azimuthDeg: number; halfAngleDeg: number; radiusM: number }
  | { kind: "zone" };

const COVERAGE_DEFAULT_RADIUS_M = 1200;

// Layers whose assets are directional sensors/emitters -> sector by default.
const SECTOR_LAYER_IDS: Set<string> = new Set([
  "layer_01_external_warning",
  "layer_02_detection",
  "layer_03_identification",
  "layer_04_suppression",
  "layer_07_accuracy_disruption",
]);

// Kinetic layers -> circle by default.
const CIRCLE_LAYER_IDS: Set<string> = new Set([
  "layer_05_mid_range_kinetic",
  "layer_06_last_line_kinetic",
]);

export function getCoverageShape(placement: Placement): CoverageShape {
  const layerId = placement.layerId;
  if (!layerId) return { kind: "none" };
  if (SECTOR_LAYER_IDS.has(layerId)) {
    return { kind: "sector", azimuthDeg: 0, halfAngleDeg: 45, radiusM: COVERAGE_DEFAULT_RADIUS_M };
  }
  if (CIRCLE_LAYER_IDS.has(layerId)) {
    return { kind: "circle", radiusM: COVERAGE_DEFAULT_RADIUS_M };
  }
  return { kind: "zone" };
}

function projectMeters(
  center: { lon: number; lat: number },
  eastM: number,
  northM: number,
): [number, number] {
  const lat = center.lat + northM / 111_320;
  const lon = center.lon + eastM / (111_320 * Math.cos(center.lat * (Math.PI / 180)));
  return [lon, lat];
}

export function buildSectorPolygon({
  center,
  azimuthDeg,
  halfAngleDeg,
  radiusM,
  segments = 24,
}: {
  center: { lon: number; lat: number };
  azimuthDeg: number;
  halfAngleDeg: number;
  radiusM: number;
  segments?: number;
}): Array<[number, number]> {
  const start = azimuthDeg - halfAngleDeg;
  const end = azimuthDeg + halfAngleDeg;
  const ring: Array<[number, number]> = [[center.lon, center.lat]];
  for (let index = 0; index <= segments; index += 1) {
    const angleDeg = start + ((end - start) * index) / segments;
    const angleRad = angleDeg * (Math.PI / 180);
    ring.push(projectMeters(center, Math.sin(angleRad) * radiusM, Math.cos(angleRad) * radiusM));
  }
  return ring;
}

// --- screenPointToSlot ---

function geoDistanceM(
  a: { lon: number; lat: number },
  b: { lon: number; lat: number },
): number {
  const latM = (b.lat - a.lat) * 111_320;
  const lonM = (b.lon - a.lon) * 111_320 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  return Math.hypot(latM, lonM);
}

export function screenPointToSlot({
  lon,
  lat,
  activeLayerId,
  slots,
  maxDistanceM = 8000,
}: {
  lon: number;
  lat: number;
  activeLayerId: DefenseLayerId;
  slots: EchelonMapSlot[];
  maxDistanceM?: number;
}): EchelonMapSlot | null {
  let best: EchelonMapSlot | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const slot of slots) {
    if (slot.layerId !== activeLayerId) continue;
    const distance = geoDistanceM({ lon, lat }, { lon: slot.position[0], lat: slot.position[1] });
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  if (!best || bestDistance > maxDistanceM) return null;
  return best;
}
