import type {
  DefenseCatalogResponse,
  DefenseLayer,
  Placement,
} from "@/shared/types/drone-defense";

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
