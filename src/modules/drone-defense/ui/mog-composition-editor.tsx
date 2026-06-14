"use client";

import { DragOutlined } from "@ant-design/icons";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DefenseAsset, PlacedDefenseObject } from "@/shared/types/defense-project";
import type {
  MogEquipmentId,
  MogEquipmentItem,
  MogWeaponId,
  MogWeaponItem,
  PlacedDefenseCompoundProfile,
} from "@/shared/types/defense-configuration";

type MogCompositionEditorProps = {
  asset: DefenseAsset;
  layerLabel: string;
  profile: PlacedDefenseCompoundProfile;
  onChange: (patch: Partial<PlacedDefenseObject>) => void;
  onClose: () => void;
};

const editorMaxSize = 720;
const editorViewportInset = 16;
const editorSquareSize = `min(${editorMaxSize}px, calc(100vw - 2rem), calc(100vh - 2rem))`;

const postTypeOptions = ["МОГ", "ПВН", "ГОР", "КПП", "Другой пост"];
const accountabilityOptions = ["Росгвардия", "МО", "ЧОП"];
const sectorWidthOptions = [90, 180, 360];

const defaultEquipment: MogEquipmentItem[] = [
  { id: "binoculars", label: "Бинокль", quantity: "2" },
  { id: "nightVision", label: "Прибор ночного видения", quantity: "1" },
  { id: "vehicle", label: "Автомобиль", quantity: "1" },
  { id: "searchlight", label: "Прожектор", quantity: "1" },
  { id: "droneDetectors", label: "Детекторы дронов", quantity: "1" },
];

const defaultWeapons: MogWeaponItem[] = [
  { id: "firearms", label: "Огнестрел", quantity: "2", rangeM: 8000 },
  { id: "antiDroneRifles", label: "Антидроновые ружья", quantity: "1", rangeM: 2000 },
  { id: "interceptorDrones", label: "Дроны-перехватчики", quantity: "0", rangeM: 5000 },
];

function formatCost(pricePerUnitMln: number | null): string {
  if (pricePerUnitMln === null) return "без CAPEX";
  return `Базовая стоимость поста: ${pricePerUnitMln.toLocaleString("ru-RU")} млн ₽/шт`;
}

function clampAzimuth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function sanitizeCount(value: string): string {
  const sanitized = value.replace(/\D/g, "");
  return sanitized === "" ? "0" : sanitized;
}

function formatRange(rangeM: number): string {
  return rangeM >= 1000 ? `${rangeM / 1000} км` : `${rangeM} м`;
}

function coverageLabelForWeapon(weapon: MogWeaponItem | undefined, sectorWidthDeg: number): string {
  return weapon ? `до ${formatRange(weapon.rangeM)}, сектор ${sectorWidthDeg}°` : `сектор ${sectorWidthDeg}°`;
}

function mergeRows<T extends { id: string }>(defaults: T[], rows: T[] | undefined): T[] {
  const rowsById = new Map((rows ?? []).map((row) => [row.id, row]));
  return defaults.map((row) => ({ ...row, ...rowsById.get(row.id) }));
}

function quantityNumber(value: string | undefined): number {
  return Number(value ?? 0) || 0;
}

function getInitialDragPosition() {
  if (typeof window === "undefined") {
    return { left: editorViewportInset, top: editorViewportInset };
  }
  const size = Math.min(
    editorMaxSize,
    Math.max(0, window.innerWidth - editorViewportInset * 2),
    Math.max(0, window.innerHeight - editorViewportInset * 2),
  );
  return {
    left: Math.max(editorViewportInset, window.innerWidth - size - editorViewportInset),
    top: editorViewportInset,
  };
}

export function MogCompositionEditor({ asset, layerLabel, profile, onChange, onClose }: MogCompositionEditorProps) {
  const equipment = mergeRows(defaultEquipment, profile.equipment);
  const weapons = mergeRows(defaultWeapons, profile.weapons);
  const sectorWidthDeg = profile.sectorWidthDeg ?? 90;
  const firstActiveWeapon = weapons.find((weapon) => quantityNumber(weapon.quantity) > 0) ?? weapons[0];
  const coverageWeaponId = profile.coverageWeaponId ?? firstActiveWeapon.id;
  const coverageWeapon = weapons.find((weapon) => weapon.id === coverageWeaponId) ?? firstActiveWeapon;

  const updateField = (patch: Partial<PlacedDefenseCompoundProfile>) => {
    onChange({ compoundProfile: { ...profile, equipment, weapons, sectorWidthDeg, coverageWeaponId, ...patch } });
  };

  const updateAzimuth = (value: string) => {
    const numeric = Number(value.replace(",", "."));
    updateField({ azimuth: clampAzimuth(numeric) });
  };

  const updateEquipmentQuantity = (id: MogEquipmentId, value: string) => {
    updateField({
      equipment: equipment.map((item) => (item.id === id ? { ...item, quantity: sanitizeCount(value) } : item)),
    });
  };

  const updateWeaponQuantity = (id: MogWeaponId, value: string) => {
    const nextWeapons = weapons.map((item) => (item.id === id ? { ...item, quantity: sanitizeCount(value) } : item));
    const nextCoverageWeapon = nextWeapons.find((item) => item.id === coverageWeaponId) ?? coverageWeapon;
    updateField({
      weapons: nextWeapons,
      armament: nextCoverageWeapon.label,
      weaponUnits: nextCoverageWeapon.quantity,
      sectorOrRange: coverageLabelForWeapon(nextCoverageWeapon, sectorWidthDeg),
    });
  };

  const updateCoverageWeapon = (id: MogWeaponId) => {
    const nextWeapons = weapons.map((item) =>
      item.id === id && quantityNumber(item.quantity) === 0 ? { ...item, quantity: "1" } : item,
    );
    const nextCoverageWeapon = nextWeapons.find((item) => item.id === id);
    updateField({
      weapons: nextWeapons,
      coverageWeaponId: id,
      armament: nextCoverageWeapon?.label ?? profile.armament,
      weaponUnits: nextCoverageWeapon?.quantity ?? profile.weaponUnits,
      sectorOrRange: coverageLabelForWeapon(nextCoverageWeapon, sectorWidthDeg),
    });
  };

  const updateSectorWidth = (value: string) => {
    const nextSectorWidth = Math.min(360, Math.max(1, Number(value) || 90));
    updateField({
      sectorWidthDeg: nextSectorWidth,
      sectorOrRange: coverageLabelForWeapon(coverageWeapon, nextSectorWidth),
    });
  };

  const editorRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{ startX: number; startY: number; startLeft: number; startTop: number } | null>(null);
  const [dragPosition, setDragPosition] = useState(getInitialDragPosition);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const editor = editorRef.current;
      const fallbackSize = Math.min(
        editorMaxSize,
        Math.max(0, window.innerWidth - editorViewportInset * 2),
        Math.max(0, window.innerHeight - editorViewportInset * 2),
      );
      const width = editor?.getBoundingClientRect().width ?? fallbackSize;
      const height = editor?.getBoundingClientRect().height ?? fallbackSize;
      const maxLeft = Math.max(editorViewportInset, window.innerWidth - width - editorViewportInset);
      const maxTop = Math.max(editorViewportInset, window.innerHeight - height - editorViewportInset);

      setDragPosition((current) => ({
        left: Math.min(Math.max(current.left, editorViewportInset), maxLeft),
        top: Math.min(Math.max(current.top, editorViewportInset), maxTop),
      }));
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragState.current) return;
      const editor = editorRef.current;
      if (!editor) return;

      const width = editor.getBoundingClientRect().width;
      const height = editor.getBoundingClientRect().height;
      const maxLeft = Math.max(editorViewportInset, window.innerWidth - width - editorViewportInset);
      const maxTop = Math.max(editorViewportInset, window.innerHeight - height - editorViewportInset);
      const nextLeft = Math.min(Math.max(dragState.current.startLeft + (event.clientX - dragState.current.startX), editorViewportInset), maxLeft);
      const nextTop = Math.min(Math.max(dragState.current.startTop + (event.clientY - dragState.current.startY), editorViewportInset), maxTop);

      setDragPosition({ left: nextLeft, top: nextTop });
    };

    const stopDrag = () => {
      setIsDragging(false);
      dragState.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [isDragging]);

  const handleDragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    dragState.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: dragPosition.left,
      startTop: dragPosition.top,
    };
    setIsDragging(true);
  };

  return (
    <aside
      ref={editorRef}
      className="pointer-events-none fixed z-30 overflow-hidden rounded-lg border border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-900/20 backdrop-blur"
      style={{ left: dragPosition.left, top: dragPosition.top, width: editorSquareSize, height: editorSquareSize }}
    >
      <div className="pointer-events-auto flex h-full min-h-0 flex-col">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <button
            type="button"
            title="Перетащить редактор"
            onPointerDown={handleDragStart}
            onClick={(event) => event.preventDefault()}
            className={`flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md pr-1 text-left select-none ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            <DragOutlined className="shrink-0 text-slate-400" />
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Редактор МОГ</span>
              <span className="block truncate text-sm font-semibold text-slate-950">Верхний уровень настроек</span>
            </span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-slate-100 text-sm font-bold text-slate-600 transition hover:bg-slate-200"
            aria-label="Закрыть редактор МОГ"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <section className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <p className="font-semibold">Средство: {asset.name}</p>
            <p className="mt-1 text-slate-500">Пометка эшелона: {layerLabel}</p>
            <p className="mt-1 text-slate-500">{formatCost(asset.pricePerUnitMln)}</p>
          </section>

          <section className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Тип поста
              <select
                value={postTypeOptions.includes(profile.postType) ? profile.postType : postTypeOptions[0]}
                onChange={(event) => updateField({ postType: event.target.value })}
                className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400"
              >
                {postTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Количество личного состава
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                value={sanitizeCount(profile.personnelCount)}
                onChange={(event) => updateField({ personnelCount: sanitizeCount(event.target.value) })}
                className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Подотчётность
              <select
                value={accountabilityOptions.includes(profile.accountability) ? profile.accountability : accountabilityOptions[0]}
                onChange={(event) => updateField({ accountability: event.target.value })}
                className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400"
              >
                {accountabilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Обмундирование и оснащение</p>
            <div className="mt-2 grid grid-cols-1 gap-1.5 md:grid-cols-2">
              {equipment.map((item) => (
                <label key={item.id} className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700">
                  <span className="min-w-0 truncate">{item.label}</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={item.quantity}
                    onChange={(event) => updateEquipmentQuantity(item.id, event.target.value)}
                    className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-sm outline-none focus:border-blue-400"
                    aria-label={`${item.label}: количество`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Оружие и покрытие карты</p>
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
              {weapons.map((weapon) => (
                <div key={weapon.id} className="flex min-h-[132px] flex-col justify-between rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{weapon.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Дальность: {formatRange(weapon.rangeM)}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-500">Кол-во</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={weapon.quantity}
                      onChange={(event) => updateWeaponQuantity(weapon.id, event.target.value)}
                      className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-sm outline-none focus:border-blue-400"
                      aria-label={`${weapon.label}: количество`}
                    />
                  </div>
                  <label className="mt-2 flex min-h-9 items-center gap-2 text-xs font-semibold text-slate-600">
                    <input
                      type="radio"
                      name="mog-coverage-weapon"
                      checked={coverageWeaponId === weapon.id}
                      onChange={() => updateCoverageWeapon(weapon.id)}
                    />
                    <span>Показывать на карте</span>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Азимут
              <input
                type="number"
                min={0}
                max={359}
                step={1}
                value={profile.azimuth}
                onChange={(event) => updateAzimuth(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400"
              />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-slate-600">
              Сектор
              <select
                value={sectorWidthOptions.includes(sectorWidthDeg) ? sectorWidthDeg : 90}
                onChange={(event) => updateSectorWidth(event.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-400"
              >
                {sectorWidthOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}°
                  </option>
                ))}
              </select>
            </label>
            <p className="col-span-2 rounded-md bg-blue-50 px-2 py-2 text-xs font-semibold text-blue-700">
              На карте: {coverageWeapon.label}, {coverageLabelForWeapon(coverageWeapon, sectorWidthDeg)}
            </p>
          </section>
        </div>
      </div>
    </aside>
  );
}
