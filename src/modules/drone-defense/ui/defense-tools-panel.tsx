"use client";

import { getBuildAssetForCatalogGroup } from "@/modules/drone-defense/domain/echelon-build-assets";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import { DefenseToolIcon } from "@/modules/drone-defense/ui/defense-tool-icon";
import type { AssetCatalogItem } from "@/shared/lib/defense-project";
import type { DefenseProject } from "@/shared/types/defense-project";
import type { Placement } from "@/shared/types/drone-defense";

type DefenseToolsPanelProps = {
  assets: AssetCatalogItem[];
  projectAssets: DefenseProject["assetLibrary"];
  slots: EchelonMapSlot[];
  placements: Placement[];
  selectedToolId: string | null;
  selectedObjectAssetId?: string;
  onSelectTool: (asset: AssetCatalogItem) => void;
  onAddTool: (asset: AssetCatalogItem, slot: EchelonMapSlot | null) => void;
  onRemoveTool: (asset: AssetCatalogItem) => void;
};

export function DefenseToolsPanel({
  assets,
  projectAssets,
  slots,
  placements,
  selectedToolId,
  selectedObjectAssetId,
  onSelectTool,
  onAddTool,
  onRemoveTool,
}: DefenseToolsPanelProps) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
        Нет средств защиты по текущему фильтру
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
      {assets.map((assetItem, index) => {
        const projectAsset = projectAssets.find((asset) => asset.id === assetItem.assetId);
        const primaryGroupId = projectAsset?.mapCatalogGroupIds?.[0];
        const buildAsset = primaryGroupId ? getBuildAssetForCatalogGroup(primaryGroupId) : null;
        const slot = slots[index] ?? null;
        const assetPlacements = placements.filter((item) => item.id === assetItem.assetId || item.catalogGroupId === primaryGroupId);
        const placement = assetPlacements[0] ?? null;
        const installedCount = assetItem.placedCount;
        const disabledReason =
          !assetItem.canPlaceInActiveLayer
            ? assetItem.compatibilityLabel
            : assetItem.placementType === "non-physical"
              ? undefined
              : slot?.status === "occupied" && !placement
                ? "Позиция уже занята другим средством"
                : undefined;

        const imageUrl = buildAsset?.imageUrl ?? assetItem.imageUrl;

        return (
          <DefenseToolIcon
            key={assetItem.assetId}
            name={assetItem.title}
            categoryLabel={assetItem.categoryLabel}
            rangeLabel={assetItem.rangeLabel}
            priceLabel={assetItem.priceLabel}
            coverageLabel={assetItem.coverageLabel}
            compatibilityLabel={assetItem.compatibilityLabel}
            compatibilityStatus={assetItem.compatibilityStatus}
            imageUrl={imageUrl}
            installedCount={installedCount}
            maxCount={assetItem.maxQuantity}
            disabledReason={disabledReason}
            canRemove={assetItem.assetId === selectedObjectAssetId}
            isPlaceholder={buildAsset?.isPlaceholder ?? !primaryGroupId}
            isSelected={selectedToolId === assetItem.assetId}
            onSelect={() => onSelectTool(assetItem)}
            onAdd={() => onAddTool(assetItem, slot)}
            onRemove={() => onRemoveTool(assetItem)}
          />
        );
      })}
    </div>
  );
}
