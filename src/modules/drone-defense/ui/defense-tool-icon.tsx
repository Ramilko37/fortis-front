"use client";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import Image from "next/image";
import { withBasePath } from "@/shared/lib/base-path";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef } from "react";

const DRAG_THRESHOLD = 6; // px before we commit to drag mode

type AssetInfo = { title: string; imageUrl: string };

export type DefenseToolIconProps = {
  name: string;
  categoryLabel: string;
  rangeLabel: string;
  priceLabel: string;
  coverageLabel: string;
  imageUrl: string;
  installedCount: number;
  disabledReason?: string;
  canRemove?: boolean;
  isPlaceholder?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onOpenCoordinates: () => void;
  onDragAsset: (event: DragEvent<HTMLDivElement>) => void;
  onPointerDragAsset: (event: PointerEvent<HTMLDivElement>) => void;
  onMouseDragAsset: (event: MouseEvent<HTMLDivElement>) => void;
  onRemove: () => void;
};

export function DefenseToolIcon({
  assetId,
  name,
  categoryLabel,
  rangeLabel,
  priceLabel,
  coverageLabel,
  imageUrl,
  installedCount,
  disabledReason,
  canRemove,
  isPlaceholder = false,
  isSelected = false,
  onSelect,
  onAdd,
  onOpenCoordinates,
  onDragAsset,
  onPointerDragAsset,
  onMouseDragAsset,
  onRemove,
}: DefenseToolIconProps & { assetId: string }) {
  const isBuilt = installedCount > 0;
  const canAdd = !disabledReason;
  const canRemoveEffective = canRemove ?? isBuilt;
  const title = disabledReason ?? `${name}: ${isBuilt ? "размещено" : "можно разместить"}`;

  const rootRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const infoRef = useRef<AssetInfo>({ title: "", imageUrl: "" });
  infoRef.current = { title, imageUrl: withBasePath(imageUrl) };

  // ── helpers ──────────────────────────────────────────────────────────

  function createGhost(clientX: number, clientY: number) {
    destroyGhost();
    const g = document.createElement("div");
    g.style.cssText =
      "position:fixed;left:0;top:0;width:32px;height:32px;border-radius:4px;" +
      "border:2px solid rgba(15,23,42,0.25);overflow:hidden;z-index:99999;" +
      "box-shadow:0 6px 18px rgba(0,0,0,0.22);pointer-events:none;will-change:transform;";
    const img = document.createElement("img");
    img.src = infoRef.current.imageUrl;
    img.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;border-radius:4px;";
    g.appendChild(img);
    g._move = moveGhost;
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
          'button[title="Удалить средство"],button[title="Разместить средство"],button[title="Ввести координаты размещения"]',
        ),
    );

  // ── unified pointer handler ──────────────────────────────────────────

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (isControlTarget(target)) return;

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      let dragging = false;

      const onMove = (ev: globalThis.PointerEvent) => {
        if (!dragging && Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY) >= DRAG_THRESHOLD) {
          dragging = true;
          createGhost(ev.clientX, ev.clientY);
          // Notify parent chain that a native-like drag began.
          const card = rootRef.current;
          if (card) {
            onDragAsset(new DragEvent("dragstart", { bubbles: true, cancelable: true }));
          }
          onPointerDragAsset(event);
        }
        if (dragging) {
          moveGhost(ev.clientX, ev.clientY);
        }
      };

      const onUp = (ev: PointerEvent | MouseEvent) => {
        if (dragging) {
          // Fire native dragend so the parent's cleanup effect fires.
          const card = rootRef.current;
          if (card) {
            card.dispatchEvent(new DragEvent("dragend", { bubbles: true, cancelable: true }));
          }
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        destroyGhost();
      };

      window.addEventListener("pointermove", onMove, { capture: true });
      window.addEventListener("pointerup", onUp, { capture: true });
    },
    [onDragAsset, onPointerDragAsset],
  );

  // ── render ───────────────────────────────────────────────────────────

  return (
    <div
      ref={rootRef}
      className={`min-w-0 rounded-lg border bg-white p-2 transition ${
        isSelected
          ? "border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_12px_24px_rgba(37,99,235,0.16)] hover:cursor-grab active:cursor-grabbing"
          : isBuilt
          ? "border-emerald-300 bg-emerald-50/70 cursor-grab active:grabbing"
          : disabledReason
            ? "border-slate-200 bg-slate-50 opacity-65 cursor-not-allowed"
            : "border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/10 cursor-grab active:grabbing"
      }`}
      title={title}
      onPointerDown={handlePointerDown}
    >
      <button type="button" className="block w-full text-left" onClick={onSelect} aria-pressed={isSelected}>
        <span className="relative block overflow-hidden rounded-md border border-slate-100 bg-slate-100">
          <Image
            src={withBasePath(imageUrl)}
            alt=""
            width={112}
            height={112}
            unoptimized
            className={`aspect-square w-full object-cover ${isPlaceholder ? "object-contain p-3" : ""} ${isBuilt ? "" : "grayscale"}`}
            draggable={false}
          />
          <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
            isBuilt ? "bg-emerald-600 text-white" : "bg-white/90 text-slate-600"
          }`}>
            {isBuilt ? "РАЗМЕЩЕНО" : "ГОТОВО"}
          </span>
          <span className={`absolute bottom-1.5 right-1.5 flex flex-col items-end gap-0.5 rounded-md px-1.5 py-1 text-[9px] font-bold leading-none ${
            isBuilt ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-600"
          }`}>
            <span>Размещено: {installedCount}</span>
          </span>
        </span>
        <span className="mt-2 block min-w-0">
          <span className="line-clamp-2 min-h-9 text-xs font-semibold leading-snug text-slate-950">{name}</span>
          <span className="mt-1 block truncate text-[10px] font-semibold text-slate-500">{categoryLabel}</span>
          <span className="mt-1 grid gap-0.5 text-[10px] leading-tight text-slate-500">
            <span className="truncate">{rangeLabel}</span>
            <span className="truncate">{coverageLabel}</span>
            <span className="truncate">{priceLabel}</span>
          </span>
        </span>
      </button>

      <div className="mt-2 grid grid-cols-[2rem_minmax(0,1fr)] gap-1.5">
        <button
          type="button"
          className="grid h-8 cursor-pointer place-items-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35"
          disabled={!canRemoveEffective}
          onClick={onRemove}
          title="Удалить средство"
        >
          <MinusOutlined />
        </button>
        <button
          type="button"
          className="flex h-8 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-md bg-blue-600 px-2 text-[11px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          disabled={!canAdd}
          onClick={onAdd}
          title={disabledReason ?? "Разместить средство"}
        >
          <PlusOutlined />
          <span>Разместить</span>
        </button>
      </div>
    </div>
  );
}
