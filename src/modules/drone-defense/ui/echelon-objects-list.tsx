"use client";

import { describePlacement } from "@/modules/drone-defense/domain/placement-helpers";
import { defenseLayers } from "@/modules/drone-defense/infra/mock-defense-data";
import type {
  DefenseCatalogResponse,
  DefenseLayerId,
  Placement,
} from "@/shared/types/drone-defense";

const statusStyles: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  inactive: "bg-slate-200 text-slate-500",
};

const statusLabel: Record<string, string> = {
  ready: "Готов",
  warning: "Внимание",
  inactive: "Выключен",
};

function formatCostRub(costRub: number): string {
  if (costRub <= 0) return "—";
  return `${(costRub / 1_000_000).toFixed(1)} млн ₽`;
}

export function EchelonObjectsList({
  layerId,
  placements,
  catalog,
  selectedPlacementId,
  onSelect,
  onLocate,
  onRemove,
}: {
  layerId: DefenseLayerId;
  placements: Placement[];
  catalog: DefenseCatalogResponse | null;
  selectedPlacementId: string | null;
  onSelect: (placementId: string) => void;
  onLocate: (placement: Placement) => void;
  onRemove: (placementId: string) => void;
}) {
  const layerPlacements = placements.filter((placement) => placement.layerId === layerId);

  if (layerPlacements.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
        <p className="text-sm font-medium text-slate-600">В этом эшелоне пока нет объектов</p>
        <p className="mt-1 text-xs text-slate-400">Перетащите средство из каталога на слот эшелона</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {layerPlacements.map((placement) => {
        const summary = describePlacement({ placement, catalog, layers: defenseLayers });
        const isSelected = placement.id === selectedPlacementId;
        return (
          <li
            key={placement.id}
            className={`rounded-lg border p-3 transition ${
              isSelected ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            <button type="button" className="block w-full text-left" onClick={() => onSelect(placement.id)}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">{summary.name}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusStyles[summary.status]}`}>
                  {statusLabel[summary.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {summary.echelonShortName} · {summary.echelonName} · ×{summary.qty} · {formatCostRub(summary.costRub)}
              </p>
            </button>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="h-7 rounded-md bg-slate-100 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-200"
                onClick={() => onLocate(placement)}
              >
                На карте
              </button>
              <button
                type="button"
                className="h-7 rounded-md bg-rose-50 px-2 text-xs font-semibold text-rose-600 hover:bg-rose-100"
                onClick={() => onRemove(placement.id)}
              >
                Удалить
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
