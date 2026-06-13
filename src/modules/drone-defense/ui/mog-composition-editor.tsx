"use client";

import type { DefenseAsset, PlacedDefenseCompoundProfile, PlacedDefenseObject } from "@/shared/types/defense-project";

type MogCompositionEditorProps = {
  asset: DefenseAsset;
  profile: PlacedDefenseCompoundProfile;
  onChange: (patch: Partial<PlacedDefenseObject>) => void;
};

function formatCost(pricePerUnitMln: number | null): string {
  if (pricePerUnitMln === null) return "без CAPEX";
  return `${pricePerUnitMln.toLocaleString("ru-RU")} млн ₽/шт`;
}

function clampAzimuth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function MogCompositionEditor({ asset, profile, onChange }: MogCompositionEditorProps) {
  const updateField = (patch: Partial<PlacedDefenseCompoundProfile>) => {
    onChange({ compoundProfile: { ...profile, ...patch } });
  };

  const updateAzimuth = (value: string) => {
    const numeric = Number(value.replace(",", "."));
    updateField({ azimuth: clampAzimuth(numeric) });
  };

  return (
    <aside className="pointer-events-none absolute right-4 top-4 z-30 w-[320px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl shadow-slate-900/20 backdrop-blur">
      <div className="pointer-events-auto">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-500">Редактор МОГ</p>
            <p className="truncate text-sm font-semibold text-slate-950">Составной пост</p>
          </div>
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-blue-700">
            Композиция
          </span>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p className="font-semibold">Тип поста: {profile.postType}</p>
          <p className="mt-1 text-[11px] text-slate-500">Средство: {asset.name}</p>
        </div>

        <div className="mt-2 grid grid-cols-1 gap-2">
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Тип поста
            <input
              value={profile.postType}
              onChange={(event) => updateField({ postType: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Личный состав
            <input
              value={profile.personnelCount}
              onChange={(event) => updateField({ personnelCount: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Подотчётность
            <input
              value={profile.accountability}
              onChange={(event) => updateField({ accountability: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Оружие
            <input
              value={profile.armament}
              onChange={(event) => updateField({ armament: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-slate-600">
            Количество/единиц
            <input
              value={profile.weaponUnits}
              onChange={(event) => updateField({ weaponUnits: event.target.value })}
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
            Сектор/угол (параметр демо)
            <input
              value={profile.sectorOrRange}
              onChange={(event) => updateField({ sectorOrRange: event.target.value })}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
            />
          </label>
        </div>

        <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
          <p>Стоимость: {formatCost(asset.pricePerUnitMln)}</p>
          <p>Дальность/сектор: {profile.sectorOrRange || "—"}</p>
        </div>
      </div>
    </aside>
  );
}
