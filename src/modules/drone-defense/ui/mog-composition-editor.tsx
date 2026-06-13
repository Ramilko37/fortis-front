"use client";

import type { DefenseAsset, PlacedDefenseCompoundProfile, PlacedDefenseObject } from "@/shared/types/defense-project";

type MogCompositionEditorProps = {
  asset: DefenseAsset;
  profile: PlacedDefenseCompoundProfile;
  onChange: (patch: Partial<PlacedDefenseObject>) => void;
  onClose: () => void;
};

function formatCost(pricePerUnitMln: number | null): string {
  if (pricePerUnitMln === null) return "без CAPEX";
  return `Демо-стоимость поста: ${pricePerUnitMln.toLocaleString("ru-RU")} млн ₽/шт`;
}

function clampAzimuth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function parseFirstNumber(value: string): string {
  return value.match(/\d+/)?.[0] ?? "";
}

function sanitizeCount(value: string): string {
  return value.replace(/\D/g, "");
}

const postTypeOptions = ["МОГ", "ПВН", "ГОР", "КПП", "Другой пост"];
const accountabilityOptions = ["Росгвардия", "МО", "ЧОП"];
const armamentOptions = ["Огнестрел", "Антидроновые ружья", "Дроны-перехватчики", "Автомат/пулемёт/ПБС"];

export function MogCompositionEditor({ asset, profile, onChange, onClose }: MogCompositionEditorProps) {
  const updateField = (patch: Partial<PlacedDefenseCompoundProfile>) => {
    onChange({ compoundProfile: { ...profile, ...patch } });
  };

  const updateAzimuth = (value: string) => {
    const numeric = Number(value.replace(",", "."));
    updateField({ azimuth: clampAzimuth(numeric) });
  };

  return (
    <aside className="pointer-events-none absolute right-4 top-4 z-30 w-[320px] max-w-[calc(100vw-2rem)] max-h-[min(70vh,calc(100vh-2rem))] overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-900/20 backdrop-blur">
      <div className="pointer-events-auto">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Редактор МОГ</p>
            <p className="truncate text-sm font-semibold text-slate-950">Составной пост</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-7 w-7 rounded-md bg-slate-100 px-0 py-0 text-[11px] font-bold text-slate-600 transition hover:bg-slate-200"
            aria-label="Закрыть редактор МОГ"
          >
            ×
          </button>
        </div>
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
          Композиция
        </span>

        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold">Тип поста: {profile.postType}</p>
          <p className="mt-1 text-[11px] text-slate-500">Средство: {asset.name}</p>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2">
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Тип поста
            <select
              value={postTypeOptions.includes(profile.postType) ? profile.postType : postTypeOptions[0]}
              onChange={(event) => updateField({ postType: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            >
              {postTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Личный состав
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={parseFirstNumber(profile.personnelCount)}
              onChange={(event) => updateField({ personnelCount: sanitizeCount(event.target.value) })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Подотчётность
            <select
              value={accountabilityOptions.includes(profile.accountability) ? profile.accountability : accountabilityOptions[0]}
              onChange={(event) => updateField({ accountability: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            >
              {accountabilityOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Оружие
            <select
              value={armamentOptions.includes(profile.armament) ? profile.armament : armamentOptions[0]}
              onChange={(event) => updateField({ armament: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            >
              {armamentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Количество/единиц
            <input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={parseFirstNumber(profile.weaponUnits)}
              onChange={(event) => updateField({ weaponUnits: sanitizeCount(event.target.value) })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Азимут (градусы)
            <input
              type="number"
              min={0}
              max={359}
              step={1}
              value={profile.azimuth}
              onChange={(event) => updateAzimuth(event.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Дальность и сектор
            <input
              value={profile.sectorOrRange}
              onChange={(event) => updateField({ sectorOrRange: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
        </div>

        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
          <p>{formatCost(asset.pricePerUnitMln)}</p>
          <p>Дальность и сектор: {profile.sectorOrRange || "—"}</p>
        </div>
      </div>
    </aside>
  );
}
