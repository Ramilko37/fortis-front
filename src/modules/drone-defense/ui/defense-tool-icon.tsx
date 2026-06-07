"use client";

import { AimOutlined, DragOutlined, EnvironmentOutlined } from "@ant-design/icons";
import Image from "next/image";
import { withBasePath } from "@/shared/lib/base-path";
import type { DefenseAssetLibraryItem } from "@/shared/types/defense-project";
import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef } from "react";

const DRAG_THRESHOLD = 6; // px before we commit to drag mode

type AssetInfo = { title: string; imageUrl: string };

export type DefenseToolIconProps = {
  name: string;
  categoryLabel: string;
  rangeLabel: string;
  priceLabel: string;
  coverageLabel: string;
  placementType: DefenseAssetLibraryItem["placementType"];
  imageUrl: string;
  installedCount: number;
  maxQuantity: number;
  disabledReason?: string;
  canRemove?: boolean;
  isPlaceholder?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
  onOpenCoordinates: () => void;
  onDragAsset: (event: ReactDragEvent<HTMLDivElement>) => void;
  onPointerDragAsset: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onMouseDragAsset: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onRemove: () => void;
};

export function DefenseToolIcon({
  assetId,
  name,
  categoryLabel,
  rangeLabel,
  priceLabel,
  coverageLabel,
  placementType,
  imageUrl,
  installedCount,
  maxQuantity,
  disabledReason,
  isPlaceholder = false,
  isSelected = false,
  onSelect,
  onOpenCoordinates,
  onDragAsset,
  onPointerDragAsset,
  onMouseDragAsset,
}: DefenseToolIconProps & { assetId: string }) {
  const canAdd = !disabledReason;
  const isZoneObject = placementType === "zone-object";
  const canDrag = canAdd;
  const title = disabledReason ?? `${name}: ${rangeLabel}. Перетащите на карту внутри выбранного эшелона`;
  const counterText = isZoneObject
      ? `Участков: ${installedCount}`
      : maxQuantity > 0
        ? `На карте: ${installedCount}/${maxQuantity}`
        : `На карте: ${installedCount}`;
  const placementBadge = isZoneObject ? "Зона" : "Карта";
  const actionText = isZoneObject ? "Нарисовать" : "Перетащите";

  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<AssetInfo>({ title: "", imageUrl: "" });
  infoRef.current = { title: `${name}\n${coverageLabel}`, imageUrl: withBasePath(imageUrl) };

  // ── helpers ──────────────────────────────────────────────────────────

  function createGhost(clientX: number, clientY: number) {
    destroyGhost();
    const g = document.createElement("div");
    g.style.cssText =
      "position:fixed;left:0;top:0;width:180px;min-height:52px;border-radius:8px;" +
      "border:1px solid rgba(59,130,246,0.35);overflow:hidden;z-index:99999;" +
      "display:grid;grid-template-columns:42px 1fr;gap:8px;align-items:center;padding:6px;" +
      "background:rgba(255,255,255,0.96);box-shadow:0 12px 28px rgba(15,23,42,0.24);" +
      "pointer-events:none;will-change:transform;font:12px system-ui,sans-serif;color:#0f172a;";
    const img = document.createElement("img");
    img.src = infoRef.current.imageUrl;
    img.style.cssText = "width:42px;height:42px;object-fit:cover;display:block;border-radius:6px;background:#f1f5f9;";
    const text = document.createElement("div");
    text.style.cssText = "min-width:0;display:grid;gap:2px;";
    const titleLine = document.createElement("strong");
    titleLine.textContent = name;
    titleLine.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;";
    const metaLine = document.createElement("span");
    metaLine.textContent = coverageLabel;
    metaLine.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#64748b;font-size:11px;";
    text.appendChild(titleLine);
    text.appendChild(metaLine);
    g.appendChild(img);
    g.appendChild(text);
    document.body.appendChild(g);
    ghostRef.current = g;
    moveGhost(clientX, clientY);
  }

  function moveGhost(clientX: number, clientY: number) {
    const g = ghostRef.current;
    if (!g) return;
    g.style.left = `${clientX - 16}px`;
    g.style.top = `${clientY - 16}px`;
  }

  function destroyGhost() {
    const g = ghostRef.current;
    if (g) {
      g.remove();
      ghostRef.current = null;
    }
  }

  // ── control target detection ─────────────────────────────────────────

  const isControlTarget = (target: HTMLElement) =>
    Boolean(
        target.closest("input,select,textarea,a") ||
        target.closest(
          'button[title="Ввести координаты"]',
        ),
    );

  // ── unified pointer handler ──────────────────────────────────────────

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canDrag || event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (isControlTarget(target)) return;

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    let dragging = false;

    const onMove = (ev: globalThis.PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) >= DRAG_THRESHOLD) {
        dragging = true;
        createGhost(ev.clientX, ev.clientY);
        onPointerDragAsset(event);
      }
      if (dragging) {
        moveGhost(ev.clientX, ev.clientY);
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      destroyGhost();
    };

    window.addEventListener("pointermove", onMove, { capture: true });
    window.addEventListener("pointerup", onUp, { capture: true });
  };

  // ── render ───────────────────────────────────────────────────────────

  return (
    <div
      ref={rootRef}
      className={`group grid min-h-[104px] min-w-0 grid-cols-[0.75rem_3rem_minmax(0,1fr)] items-center gap-1.5 rounded-lg border bg-white p-1.5 transition ${
        isSelected
          ? "border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_12px_24px_rgba(37,99,235,0.16)]"
          : installedCount > 0
          ? "border-emerald-300 bg-emerald-50/70"
          : disabledReason
            ? "border-slate-200 bg-slate-50 opacity-65 cursor-not-allowed"
            : "border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/10"
      } ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
      data-placement-type={placementType}
      data-can-drag={canDrag ? "true" : "false"}
      data-testid={`defense-tool-card-${assetId}`}
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${name}. ${counterText}. Перетащите на карту`}
      title={title}
      draggable={canDrag}
      onDragStart={(event) => {
        if (!canDrag) {
          event.preventDefault();
          return;
        }
        onDragAsset(event);
      }}
      onPointerDown={handlePointerDown}
      onMouseDown={(event) => {
        if (canDrag) onMouseDragAsset(event);
      }}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <span className="grid h-full place-items-center text-slate-400" aria-hidden="true">
        {canDrag ? <DragOutlined /> : null}
      </span>

      <span className="relative block h-12 w-12 overflow-hidden rounded-md border border-slate-100 bg-slate-100">
        <Image
          src={withBasePath(imageUrl)}
          alt=""
          width={56}
          height={56}
          unoptimized
          className={`h-full w-full object-cover ${isPlaceholder ? "object-contain p-2" : ""}`}
          draggable={false}
        />
      </span>

      <div className="min-w-0">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="min-w-0 truncate text-xs font-semibold leading-snug text-slate-950">{name}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            installedCount > 0 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
          }`}>
            {isZoneObject ? `${installedCount} уч.` : maxQuantity > 0 ? `${installedCount}/${maxQuantity}` : `${installedCount}`}
          </span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] leading-tight text-slate-500">
          <span className="truncate">{categoryLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{coverageLabel}</span>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-[11px] leading-tight text-slate-500">
          <span className="truncate">{priceLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{placementBadge}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`min-w-0 truncate text-[11px] font-semibold ${
            disabledReason ? "text-rose-600" : "text-blue-600"
          }`}>
            {disabledReason ?? actionText}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="grid h-6 w-6 cursor-pointer place-items-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-35"
              disabled={!canAdd}
              onClick={(event) => {
                event.stopPropagation();
                onOpenCoordinates();
              }}
              title="Ввести координаты"
              aria-label="Ввести координаты"
            >
              {isZoneObject ? <AimOutlined /> : <EnvironmentOutlined />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
