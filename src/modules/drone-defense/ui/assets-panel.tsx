"use client";

import {
  BorderOuterOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  GatewayOutlined,
} from "@ant-design/icons";
import { DefenseAssetCard, type PlacementMode } from "./defense-asset-card";
import styles from "./drone-defense-prototype.module.css";
import { useDefenseStudioStore } from "../domain/use-defense-studio-store";
import type { DefenseAssetKind } from "@/shared/types/drone-defense";

// Маппинг режимов размещения для разных типов объектов
const placementModeByKind: Record<DefenseAssetKind, PlacementMode> = {
  operator_substation: "point",
  scaffolding: "point",
  fbs_enclosure: "point",
  perimeter_barrier: "line",
  cable_mesh: "polygon",
};

// Иконки для каждого типа объекта
function getAssetIcon(kind: DefenseAssetKind) {
  switch (kind) {
    case "operator_substation":
      return <ApartmentOutlined />;
    case "scaffolding":
      return <DeploymentUnitOutlined />;
    case "fbs_enclosure":
      return <GatewayOutlined />;
    case "perimeter_barrier":
      return <BorderOuterOutlined />;
    case "cable_mesh":
      return <BorderOuterOutlined />;
  }
}

export function AssetsPanel({
  onSelectAsset,
  placingKind,
  onCancelPlacement,
}: {
  onSelectAsset: (kind: DefenseAssetKind) => void;
  placingKind: DefenseAssetKind | null;
  onCancelPlacement: () => void;
}) {
  const catalog = useDefenseStudioStore((state) => state.catalog);
  const scenarioId = useDefenseStudioStore((state) => state.scenarioId);
  const localPlacements = useDefenseStudioStore((state) => state.localPlacementsByScenario[scenarioId] ?? []);

  // Группируем ассеты по kind для подсчета количества размещенных
  const placedCounts = localPlacements.reduce((acc, p) => {
    acc[p.assetId] = (acc[p.assetId] || 0) + p.qty;
    return acc;
  }, {} as Record<string, number>);

  if (!catalog) return null;

  return (
    <aside className={styles.assetsPanel} aria-label="Защитные элементы">
      <div className={styles.panelHeader}>
        <h2>Защитные элементы</h2>
      </div>
      
      {/* Поиск */}
      <div className={styles.searchRow}>
        <span>🔍</span>
        <input
          type="text"
          placeholder="Поиск средств защиты..."
          aria-label="Поиск"
        />
      </div>

      <div className={styles.assetList}>
        {catalog.assets.map((asset) => {
          const placedCount = placedCounts[asset.id] || 0;
          const maxQuantity = 0;
          
          return (
            <DefenseAssetCard
              key={asset.id}
              id={asset.id}
              label={asset.name}
              tone={"cyan"} // TODO: мапить цвет из asset.color или layer
              icon={getAssetIcon(asset.kind)}
              category={"Защита"}
              coverageType="круг"
              coverageRadiusM={asset.coverageRadiusM}
              costMln={Math.round(asset.cost.capexRub / 1_000_000)}
              placementMode={placementModeByKind[asset.kind] || "point"}
              placedCount={placedCount}
              maxQuantity={maxQuantity}
              compatibleWithEchelon={true} // TODO: проверять совместимость с эшелоном
              onOpenDetails={() => console.log("Open details for", asset.id)}
              onDragStart={() => {
                onSelectAsset(asset.kind);
              }}
            />
          );
        })}
      </div>

      <div className={styles.dragHint}>
        <span className={styles.mouseGlyph} />
        <p>
          {placingKind ? "Кликните по карте, чтобы разместить защиту" : "Выберите элемент и кликните по карте"}
        </p>
      </div>
      {placingKind ? (
        <button className={styles.performanceButton} type="button" onClick={onCancelPlacement}>
          Отменить размещение
        </button>
      ) : null}
    </aside>
  );
}
