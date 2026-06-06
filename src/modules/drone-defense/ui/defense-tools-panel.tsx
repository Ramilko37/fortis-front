"use client";

import { getBuildAssetForCatalogGroup } from "@/modules/drone-defense/domain/echelon-build-assets";
import type { EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import { DefenseToolIcon } from "@/modules/drone-defense/ui/defense-tool-icon";
import type { AssetCatalogItem } from "@/shared/lib/defense-project";
import type { DefenseProject } from "@/shared/types/defense-project";
import type { Placement } from "@/shared/types/drone-defense";
import type { DragEvent, MouseEvent, PointerEvent } from "react";

type DefenseToolsPanelProps = {
  assets: AssetCatalogItem[];
  projectAssets: DefenseProject["assetLibrary"];
  placements: Placement[];
  selectedToolId: string | null;
  selectedObjectAssetId?: string;
  onSelectTool: (asset: AssetCatalogItem) => void;
  onAddTool: (asset: AssetCatalogItem, slot: EchelonMapSlot | null) => void;
  onOpenCoordinates: (asset: AssetCatalogItem) => void;
  onDragAsset: (asset: AssetCatalogItem, event: DragEvent<HTMLDivElement>) => void;
  onPointerDragAsset: (asset: AssetCatalogItem, event: PointerEvent<HTMLDivElement>) => void;
  onMouseDragAsset: (asset: AssetCatalogItem, event: MouseEvent<HTMLDivElement>) => void;
  onRemoveTool: (asset: AssetCatalogItem) => void;
};

export function DefenseToolsPanel({
  assets,
  projectAssets,
  placements,
  selectedToolId,
  selectedObjectAssetId,
  onSelectTool,
  onAddTool,
  onOpenCoordinates,
  onDragAsset,
  onPointerDragAsset,
  onMouseDragAsset,
  onRemoveTool,
}: DefenseToolsPanelProps) {
  if (assets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
        Нет средств защиты
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
      {assets.map((assetItem) => {
        const projectAsset = projectAssets.find((asset) => asset.id === assetItem.assetId);
        const primaryGroupId = projectAsset?.mapCatalogGroupIds?.[0];
        const buildAsset = primaryGroupId ? getBuildAssetForCatalogGroup(primaryGroupId) : null;
        const assetPlacements = placements.filter((item) => item.id === assetItem.assetId || item.catalogGroupId === primaryGroupId);
        const placement = assetPlacements[0] ?? null;
        const installedCount = assetItem.placedCount;
        const disabledReason = undefined;

        const imageUrl = buildAsset?.imageUrl ?? assetItem.imageUrl;

        return (
          <DefenseToolIcon
            key={assetItem.assetId}
            name={assetItem.title}
            categoryLabel={assetItem.categoryLabel}
            rangeLabel={assetItem.rangeLabel}
            priceLabel={assetItem.priceLabel}
            coverageLabel={assetItem.coverageLabel}
            imageUrl={imageUrl}
            installedCount={installedCount}
            disabledReason={disabledReason}
            canRemove={assetItem.assetId === selectedObjectAssetId}
            isPlaceholder={buildAsset?.isPlaceholder ?? !primaryGroupId}
            isSelected={selectedToolId === assetItem.assetId}
            onSelect={() => onSelectTool(assetItem)}
            onAdd={() => onAddTool(assetItem, null)}
            onOpenCoordinates={() => onOpenCoordinates(assetItem)}
            onDragAsset={(event) => onDragAsset(assetItem, event)}
            onPointerDragAsset={(event) => onPointerDragAsset(assetItem, event)}
            onMouseDragAsset={(event) => onMouseDragAsset(assetItem, event)}
            onRemove={() => onRemoveTool(assetItem)}
          />
        );
      })}
    </div>
  );
}
