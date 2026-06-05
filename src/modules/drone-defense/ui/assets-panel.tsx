"use client";

import {
  DragOutlined,
  BuildOutlined,
  BorderOuterOutlined,
  ApartmentOutlined,
  DeploymentUnitOutlined,
  GatewayOutlined,
} from "@ant-design/icons";
import { assetCatalog, type AssetCatalogItem, type ObjectKind, type ProtectiveObjectKind } from "../domain/prototype-types";
import styles from "./drone-defense-prototype.module.css";

function AssetIcon({ kind }: { kind: AssetCatalogItem["kind"] }) {
  if (kind === "facility") return <BuildOutlined />;
  if (kind === "operator_substation") return <ApartmentOutlined />;
  if (kind === "scaffolding") return <DeploymentUnitOutlined />;
  if (kind === "fbs_enclosure") return <GatewayOutlined />;
  if (kind === "perimeter_barrier") return <BorderOuterOutlined />;
  return <BuildOutlined />;
}

export function AssetsPanel({
  onSelectAsset,
  placingKind,
  onCancelPlacement,
}: {
  onSelectAsset: (kind: ObjectKind) => void;
  placingKind: ObjectKind | null;
  onCancelPlacement: () => void;
}) {
  return (
    <aside className={styles.assetsPanel} aria-label="Защитные элементы">
      <div className={styles.panelHeader}>
        <h2>Защитные элементы</h2>
      </div>
      <div className={styles.assetList}>
        {assetCatalog.map((item) => (
          <button
            key={item.kind}
            className={`${styles.assetItem} ${styles[item.tone]}`}
            type="button"
            onClick={() => onSelectAsset(item.kind as ProtectiveObjectKind)}
          >
            <span className={styles.assetGlyph}>
              <AssetIcon kind={item.kind} />
            </span>
            <span>{item.label}</span>
            <DragOutlined className={styles.dragHandle} />
          </button>
        ))}
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
