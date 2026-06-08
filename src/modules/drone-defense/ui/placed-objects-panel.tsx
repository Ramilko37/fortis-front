"use client";

import { useMemo } from "react";
import { DeleteOutlined, EyeOutlined } from "@ant-design/icons";
import type { DefenseProject } from "@/shared/types/defense-project";
import { priceForPlacedObject } from "@/shared/lib/defense-project";

type PlacedObjectsPanelProps = {
  project: DefenseProject;
  selectedObjectId: string | undefined;
  hoveredObjectId?: string | null;
  onSelectObject: (objectId: string) => void;
  onDeleteObject: (objectId: string) => void;
  onHoverObject?: (objectId: string | null) => void;
  onShowOnMap?: (objectId: string) => void;
};

function StatusBadge({ status }: { status: DefenseProject["placedObjects"][number]["status"] }) {
  const map: Record<DefenseProject["placedObjects"][number]["status"], { label: string; className: string }> = {
    active: { label: "Активен", className: "bg-emerald-100 text-emerald-700" },
    planned: { label: "Запланирован", className: "bg-blue-100 text-blue-700" },
    inactive: { label: "Неактивен", className: "bg-slate-100 text-slate-500" },
    maintenance: { label: "Обслуживание", className: "bg-amber-100 text-amber-700" },
  };
  const info = map[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${info.className}`}>
      {info.label}
    </span>
  );
}

function formatMoney(value: number) {
  if (value === 0) return "—";
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} млн ₽`;
}

export function PlacedObjectsPanel({
  project,
  selectedObjectId,
  hoveredObjectId,
  onSelectObject,
  onDeleteObject,
  onHoverObject,
  onShowOnMap,
}: PlacedObjectsPanelProps) {
  const activeLayerId = project.activeLayerId ?? project.layers[0]?.id;
  const activeLayer = project.layers.find((l) => l.id === activeLayerId);
  const placedObjects = useMemo(
    () => project.placedObjects.filter((obj) => obj.layerId === activeLayerId),
    [project.placedObjects, activeLayerId],
  );

  if (!activeLayer) return null;

  const handleDelete = (e: React.MouseEvent, objectId: string) => {
    e.stopPropagation();
    onDeleteObject(objectId);
  };

  const handleShowOnMap = (e: React.MouseEvent, objectId: string) => {
    e.stopPropagation();
    onSelectObject(objectId);
    onShowOnMap?.(objectId);
  };

  return (
    <div className="pointer-events-auto border border-white/70 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur rounded-xl p-3">
      {/* Summary strip */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">Эшелон {activeLayer.code}</p>
          <p className="text-sm font-semibold text-slate-950">{activeLayer.name}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>{placedObjects.length} об.</span>
          <span>
            {placedObjects.reduce((acc, o) => acc + o.quantity, 0)} шт.
          </span>
        </div>
      </div>

      {/* Objects list */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {placedObjects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center">
            <p className="text-xs font-medium text-slate-400">В эшелоне пока нет объектов</p>
            <p className="mt-1 text-[11px] text-slate-400">Перетащите средство из библиотеки на карту</p>
          </div>
        ) : (
          placedObjects.map((object) => {
            const asset = project.assetLibrary.find((a) => a.id === object.assetId);
            const isSelected = selectedObjectId === object.id;
            const isHovered = hoveredObjectId === object.id;
            const totalPrice = priceForPlacedObject(project, object) * object.quantity;
            const hasConflicts =
              object.hasGeometryConflict || object.hasCoverageConflict || object.hasTerrainConflict;
            const categoryColor = asset ? getCategoryColor(asset.category) : "#94a3b8";

            return (
              <button
                key={object.id}
                type="button"
                className={`group pointer-events-auto w-full overflow-hidden rounded-lg border transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-600/10"
                    : isHovered
                      ? "border-blue-300 bg-blue-50/60"
                      : "border-slate-200 bg-white hover:border-slate-300"
                }`}
                onClick={() => onSelectObject(object.id)}
                onMouseEnter={() => onHoverObject?.(object.id)}
                onMouseLeave={() => onHoverObject?.(null)}
              >
                <div className="flex items-start gap-2.5 px-2.5 py-2">
                  {/* Category dot */}
                  <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: categoryColor }} />

                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-xs font-semibold text-slate-900">
                        {asset?.name ?? object.name ?? "Объект"}
                      </span>
                      {hasConflicts && (
                        <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-600">!</span>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{categoryLabel(asset?.category)}</span>
                      <span>·</span>
                      <span>L{activeLayer.order}</span>
                      <span>·</span>
                      <span>{object.quantity} шт.</span>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">
                        {formatMoney(totalPrice)}
                      </span>
                      <StatusBadge status={object.status} />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                    <button
                      type="button"
                      className="grid h-6 w-6 cursor-pointer place-items-center rounded-md bg-slate-100 text-slate-500 hover:bg-blue-100 hover:text-blue-600"
                      title="Показать на карте"
                      aria-label="Показать на карте"
                      onClick={(e) => handleShowOnMap(e, object.id)}
                    >
                      <EyeOutlined />
                    </button>
                    <button
                      type="button"
                      className="grid h-6 w-6 cursor-pointer place-items-center rounded-md bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600"
                      title="Удалить объект"
                      aria-label="Удалить объект"
                      onClick={(e) => handleDelete(e, object.id)}
                    >
                      <DeleteOutlined />
                    </button>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Layer total */}
      {placedObjects.length > 0 && (
        <div className="mt-3 border-t border-slate-200 pt-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">Итого по эшелону</span>
            <span className="font-bold text-slate-900">
              {formatMoney(placedObjects.reduce((acc, o) => acc + priceForPlacedObject(project, o) * o.quantity, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function getCategoryColor(category?: string): string {
  const colors: Record<string, string> = {
    "early-warning": "#10b981",
    detection: "#2563eb",
    classification: "#38bdf8",
    jamming: "#f97316",
    spoofing: "#a855f7",
    kinetic: "#ef4444",
    interceptor: "#dc2626",
    "passive-protection": "#64748b",
    "engineering-protection": "#6b7280",
    infrastructure: "#14b8a6",
    software: "#8b5cf6",
    "command-center": "#059669",
    "external-service": "#0f766e",
  };
  return colors[category ?? ""] ?? "#94a3b8";
}

function categoryLabel(category?: string): string {
  const labels: Record<string, string> = {
    "early-warning": "Предупреждение",
    detection: "Обнаружение",
    classification: "Классификация",
    jamming: "Подавление",
    spoofing: "Спуфинг",
    kinetic: "Поражение",
    interceptor: "Перехват",
    "passive-protection": "Пассивная защита",
    "engineering-protection": "Инженерная защита",
    infrastructure: "Инфраструктура",
    software: "ПО",
    "command-center": "Командный центр",
    "external-service": "Внешний сервис",
  };
  return labels[category ?? ""] ?? category ?? "—" ;
}
