"use client";

import type { EchelonCatalogGroup } from "@/modules/drone-defense/infra/mock-defense-data";
import { getBuildAssetForCatalogGroup } from "@/modules/drone-defense/domain/echelon-build-assets";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import { DefenseToolIcon } from "@/modules/drone-defense/ui/defense-tool-icon";
import type { Placement } from "@/shared/types/drone-defense";

type DefenseToolsPanelProps = {
  groups: EchelonCatalogGroup[];
  slots: EchelonMapSlot[];
  placements: Placement[];
  selectedToolId: string | null;
  onSelectTool: (group: EchelonCatalogGroup) => void;
  onAddTool: (group: EchelonCatalogGroup, slot: EchelonMapSlot) => void;
  onRemoveTool: (group: EchelonCatalogGroup) => void;
};

export function DefenseToolsPanel({
  groups,
  slots,
  placements,
  selectedToolId,
  onSelectTool,
  onAddTool,
  onRemoveTool,
}: DefenseToolsPanelProps) {
  if (groups.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
        Нет средств защиты по текущему фильтру
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {groups.map((group, index) => {
        const asset = getBuildAssetForCatalogGroup(group.id);
        const slot = slots[index] ?? null;
        const placement = slot
          ? placements.find((item) => item.catalogGroupId === group.id && item.slotId === slot.id)
          : null;
        const installedCount = placement?.qty ?? 0;
        const disabledReason = !slot
          ? "Для этого средства нет слота на выбранном эшелоне"
          : slot.status === "occupied" && !placement
            ? "Слот уже занят другим средством"
            : undefined;

        if (!asset) return null;

        return (
          <DefenseToolIcon
            key={group.id}
            name={group.name}
            roleLabel={`${asset.label} · слот ${slot?.label ?? "—"} · вес ${group.weightPct}%`}
            imageUrl={asset.imageUrl}
            installedCount={installedCount}
            maxCount={1}
            disabledReason={disabledReason}
            isPlaceholder={asset.isPlaceholder}
            isSelected={selectedToolId === group.id}
            onSelect={() => onSelectTool(group)}
            onAdd={() => slot && onAddTool(group, slot)}
            onRemove={() => onRemoveTool(group)}
          />
        );
      })}
    </div>
  );
}
