"use client";

import { useEffect, useState } from "react";
import type { PlacementValidationResult } from "@/shared/types/defense-project";

export type CoordinatePlacementPanelProps = {
  assetName: string;
  layerLabel: string;
  validationMessage?: string;
  validationLevel?: PlacementValidationResult["level"];
  onCheck: (input: CoordinatePlacementInput) => void;
  onPlace: (input: CoordinatePlacementInput) => void;
  onCancel: () => void;
};

export type CoordinatePlacementInput = {
  lat: string;
  lng: string;
  altitude: string;
  notes: string;
};

const emptyInput: CoordinatePlacementInput = {
  lat: "",
  lng: "",
  altitude: "",
  notes: "",
};

export function CoordinatePlacementPanel({
  assetName,
  layerLabel,
  validationMessage,
  validationLevel,
  onCheck,
  onPlace,
  onCancel,
}: CoordinatePlacementPanelProps) {
  const [input, setInput] = useState(emptyInput);
  const messageClass =
    validationLevel === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : validationLevel === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-rose-200 bg-rose-50 text-rose-700";

  useEffect(() => {
    setInput(emptyInput);
  }, [assetName, layerLabel]);

  const updateInput = (patch: Partial<CoordinatePlacementInput>) => {
    setInput((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="pointer-events-none absolute inset-x-3 top-24 z-40 flex justify-end lg:inset-x-5">
      <form
        className="pointer-events-auto w-full max-w-sm rounded-xl border border-white/70 bg-white/95 p-3 shadow-2xl shadow-slate-950/25 backdrop-blur"
        onSubmit={(event) => {
          event.preventDefault();
          onPlace(input);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Размещение по координатам</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">
              Средство: {assetName}
            </p>
            <p className="truncate text-xs text-slate-500">
              Эшелон: {layerLabel}
            </p>
          </div>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-md border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
            onClick={onCancel}
            aria-label="Закрыть"
            title="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Широта
            <input
              value={input.lat}
              onChange={(event) => updateInput({ lat: event.target.value })}
              inputMode="decimal"
              placeholder="55.4400"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-950 outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Долгота
            <input
              value={input.lng}
              onChange={(event) => updateInput({ lng: event.target.value })}
              inputMode="decimal"
              placeholder="37.1000"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-950 outline-none focus:border-blue-400"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-slate-600">
            Высота, м
            <input
              value={input.altitude}
              onChange={(event) => updateInput({ altitude: event.target.value })}
              inputMode="decimal"
              placeholder="опционально"
              className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-normal text-slate-950 outline-none focus:border-blue-400"
            />
          </label>
          <label className="col-span-2 grid gap-1 text-xs font-semibold text-slate-600">
            Комментарий
            <textarea
              value={input.notes}
              onChange={(event) => updateInput({ notes: event.target.value })}
              rows={2}
              className="resize-none rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-normal text-slate-950 outline-none focus:border-blue-400"
            />
          </label>
        </div>

        {validationMessage ? (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${messageClass}`}>
            {validationMessage}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => onCheck(input)}
          >
            Проверить точку
          </button>
          <button
            type="submit"
            className="h-9 cursor-pointer rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
          >
            Разместить
          </button>
        </div>
      </form>
    </div>
  );
}
