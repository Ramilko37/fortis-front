"use client";

import { MinusOutlined, PlusOutlined } from "@ant-design/icons";
import Image from "next/image";
import { withBasePath } from "@/shared/lib/base-path";

export type DefenseToolIconProps = {
  name: string;
  roleLabel: string;
  imageUrl: string;
  installedCount: number;
  maxCount: number;
  disabledReason?: string;
  isPlaceholder?: boolean;
  isSelected?: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onRemove: () => void;
};

export function DefenseToolIcon({
  name,
  roleLabel,
  imageUrl,
  installedCount,
  maxCount,
  disabledReason,
  isPlaceholder = false,
  isSelected = false,
  onSelect,
  onAdd,
  onRemove,
}: DefenseToolIconProps) {
  const isBuilt = installedCount > 0;
  const canAdd = installedCount < maxCount && !disabledReason;
  const canRemove = isBuilt;
  const title = disabledReason ?? `${name}: ${isBuilt ? "размещено" : "можно разместить"}`;

  return (
    <div
      className={`min-w-0 rounded-lg border bg-white p-2 transition ${
        isSelected
          ? "border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_12px_24px_rgba(37,99,235,0.16)]"
          : isBuilt
            ? "border-emerald-300 bg-emerald-50/70"
            : disabledReason
              ? "border-slate-200 bg-slate-50 opacity-65"
              : "border-slate-200 hover:border-blue-300 hover:shadow-md hover:shadow-blue-900/10"
      }`}
      title={title}
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
          <span className={`absolute left-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${isBuilt ? "bg-emerald-600 text-white" : "bg-white/90 text-slate-600"}`}>
            {isBuilt ? "РАЗМЕЩЕНО" : "ГОТОВО"}
          </span>
          <span className={`absolute bottom-1.5 right-1.5 flex flex-col items-end gap-0.5 rounded-md px-1.5 py-1 text-[9px] font-bold leading-none ${isBuilt ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-600"}`}>
            <span>Размещено: {installedCount}</span>
            <span>Лимит: {maxCount}</span>
          </span>
        </span>
        <span className="mt-2 block min-w-0">
          <span className="line-clamp-2 min-h-9 text-xs font-semibold leading-snug text-slate-950">{name}</span>
          <span className="mt-1 block truncate text-[10px] text-slate-500">{roleLabel}</span>
        </span>
      </button>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          className="grid h-8 cursor-pointer place-items-center rounded-md bg-slate-100 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35"
          disabled={!canRemove}
          onClick={onRemove}
          title="Удалить средство"
        >
          <MinusOutlined />
        </button>
        <button
          type="button"
          className="grid h-8 cursor-pointer place-items-center rounded-md bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          disabled={!canAdd}
          onClick={onAdd}
          title={disabledReason ?? "Разместить средство"}
        >
          <PlusOutlined />
        </button>
      </div>
    </div>
  );
}
