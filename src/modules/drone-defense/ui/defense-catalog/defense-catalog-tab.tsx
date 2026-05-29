"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { withBasePath } from "@/shared/lib/base-path";
import defenseCatalogSeed from "@/modules/drone-defense/infra/data/defense-catalog-seed.json";
import { THREAT_TYPES } from "../data/threat-types";
import {
  defenseLayerStatusColor,
  defenseLayerStatusLabel,
  getLayerStatus,
  type DefenseAsset,
  type DefenseCatalogData,
  type DefenseLayer,
  type DefenseLayerId,
  type DefenseLayerStatus,
} from "../../domain/prototype-types";
import styles from "./defense-catalog-tab.module.css";

const catalogData = defenseCatalogSeed as DefenseCatalogData;

type ModelFilter = "all" | "with" | "without";
type ValueFilter = "all" | "with" | "without";
type InsightView = "matrix" | "hex";

type HexCell = {
  id: string;
  q: number;
  r: number;
  x: number;
  y: number;
  distance: number;
};

const SQRT3 = Math.sqrt(3);
const HEX_RADIUS = 11;

const HEX_CELLS: HexCell[] = (() => {
  const maxRing = 4;
  const cells: HexCell[] = [];
  for (let q = -maxRing; q <= maxRing; q += 1) {
    for (let r = -maxRing; r <= maxRing; r += 1) {
      const distance = (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
      if (distance > maxRing) continue;
      const x = HEX_RADIUS * SQRT3 * (q + r / 2);
      const y = HEX_RADIUS * 1.5 * r;
      cells.push({ id: `${q}:${r}`, q, r, x, y, distance });
    }
  }
  return cells;
})();

const LAYER_ZONE_BAND: Record<number, [number, number]> = {
  1: [3, 4],
  2: [3, 4],
  3: [2, 3],
  4: [2, 3],
  5: [1, 2],
  6: [1, 2],
  7: [1, 1],
  8: [0, 1],
  9: [0, 0],
};

const MODEL_URL_MAP: Record<string, string> = {
  "/models/cable_mesh_curtain_textured.glb": "/models/protection/02_cable_mesh_curtain_textured.glb",
  "/models/perimeter_fbs_cable_barrier_textured.glb": "/models/protection/04_perimeter_fbs_cable_barrier_textured.glb",
  "/models/fbs_protection_enclosure_textured.glb": "/models/protection/03_fbs_protection_enclosure_textured.glb",
};

function normalizeModelUrl(modelUrl: string | null): string | null {
  if (!modelUrl) return null;
  return MODEL_URL_MAP[modelUrl] ?? null;
}

function hasValue(value: number | null): boolean {
  return typeof value === "number" && Number.isFinite(value);
}

function formatScore(value: number | null) {
  return hasValue(value) ? value : "—";
}

function statusFromLayer(layer: DefenseLayer): DefenseLayerStatus {
  return layer.statusFromDashboard ?? getLayerStatus(layer.readinessPctFromDashboard);
}

function layerStatusStyle(status: DefenseLayerStatus) {
  return {
    color: defenseLayerStatusColor[status],
    borderColor: `${defenseLayerStatusColor[status]}44`,
    backgroundColor: `${defenseLayerStatusColor[status]}12`,
  };
}

function hexPath(cx: number, cy: number, size: number) {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    points.push(`${x},${y}`);
  }
  return points.join(" ");
}

function layerBandIntensity(layerNumber: number | null, distance: number): number {
  if (layerNumber === null) return 0;
  const band = LAYER_ZONE_BAND[layerNumber];
  if (!band) return 0;
  const [minBand, maxBand] = band;
  if (distance >= minBand && distance <= maxBand) return 1;
  if (distance >= minBand - 1 && distance <= maxBand + 1) return 0.45;
  return 0.12;
}

function AssetPreviewModel({ modelPath }: { modelPath: string }) {
  const gltf = useGLTF(withBasePath(modelPath));
  const clonedScene = useMemo(() => {
    const nextScene = gltf.scene.clone(true);
    const bounds = new THREE.Box3().setFromObject(nextScene);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const maxAxis = Math.max(size.x, size.y, size.z, 1);
    const normalizedScale = 32 / maxAxis;
    nextScene.position.sub(center);
    nextScene.scale.setScalar(normalizedScale);
    return nextScene;
  }, [gltf.scene]);

  return <primitive object={clonedScene} />;
}

function Asset3DPreview({ asset }: { asset: DefenseAsset }) {
  const modelPath = normalizeModelUrl(asset.visualization.modelUrl);
  if (!modelPath) {
    return <div className={styles.previewPlaceholder}>Для этого средства 3D-модель не назначена</div>;
  }

  return (
    <div className={styles.previewCanvasWrap}>
      <Canvas camera={{ position: [34, 24, 34], fov: 34 }} dpr={[1, 1.4]}>
        <color attach="background" args={["#f6f9ff"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[28, 42, 24]} intensity={1.25} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
          <circleGeometry args={[42, 48]} />
          <meshStandardMaterial color="#e7eef8" />
        </mesh>
        <Suspense fallback={<Html center><span className={styles.previewLoading}>Загрузка модели...</span></Html>}>
          <AssetPreviewModel modelPath={modelPath} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={24} maxDistance={78} />
      </Canvas>
    </div>
  );
}

export function DefenseCatalogTab() {
  const [selectedLayerId, setSelectedLayerId] = useState<DefenseLayerId | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [scoreFilter, setScoreFilter] = useState<ValueFilter>("all");
  const [quantityFilter, setQuantityFilter] = useState<ValueFilter>("all");
  const [insightView, setInsightView] = useState<InsightView>("hex");

  const layers = useMemo(
    () => [...catalogData.defenseLayers].sort((a, b) => a.number - b.number),
    [],
  );

  const assets = useMemo(() => catalogData.defenseAssets, []);

  const categoryOptions = useMemo(
    () => Array.from(new Set(assets.map((asset) => asset.category))).sort((a, b) => a.localeCompare(b, "ru")),
    [assets],
  );

  const selectedLayer = useMemo(
    () => (selectedLayerId ? layers.find((layer) => layer.id === selectedLayerId) ?? null : null),
    [layers, selectedLayerId],
  );

  const filteredAssets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (selectedLayerId && !asset.defenseLayerIds.includes(selectedLayerId)) return false;
      if (category !== "all" && asset.category !== category) return false;
      if (modelFilter === "with" && !asset.visualization.modelUrl) return false;
      if (modelFilter === "without" && asset.visualization.modelUrl) return false;
      if (scoreFilter === "with" && !hasValue(asset.score1to10)) return false;
      if (scoreFilter === "without" && hasValue(asset.score1to10)) return false;
      if (quantityFilter === "with" && !hasValue(asset.quantityOnSite)) return false;
      if (quantityFilter === "without" && hasValue(asset.quantityOnSite)) return false;
      if (!normalizedSearch) return true;
      return asset.name.toLowerCase().includes(normalizedSearch);
    });
  }, [assets, category, modelFilter, quantityFilter, scoreFilter, search, selectedLayerId]);

  const selectedAsset = useMemo(
    () => (selectedAssetId ? assets.find((asset) => asset.id === selectedAssetId) ?? null : null),
    [assets, selectedAssetId],
  );

  const passiveLayerAssetCount = layers.find((layer) => layer.id === "layer_08_passive_protection")?.assetCount ?? 0;
  const coveredOrPartial = catalogData.summary.layersCoveredOrPartialByDashboard;
  const missingLayerCount = catalogData.summary.layersWithMissingDashboardReadiness.length;

  const onSelectLayer = (layerId: DefenseLayerId) => {
    setSelectedAssetId(null);
    setSelectedLayerId((prev) => (prev === layerId ? null : layerId));
  };

  const resetFilters = () => {
    setSearch("");
    setCategory("all");
    setModelFilter("all");
    setScoreFilter("all");
    setQuantityFilter("all");
    setSelectedLayerId(null);
    setSelectedAssetId(null);
  };

  const detailLayer = selectedAsset
    ? layers.find((layer) => layer.number === selectedAsset.layerNumber) ?? null
    : selectedLayer;

  return (
    <section className={styles.catalogPage} aria-label="Каталог защиты">
      <header className={styles.header}>
        <div>
          <h2>Каталог защиты / 9 эшелонов</h2>
          <p>
            Источник: seed-каталог · {catalogData.summary.totalAssets} средства · {catalogData.summary.totalLayers} эшелонов ·
            данные нормализованы из migration-пакета в Эшелоны 1–9
          </p>
        </div>
        <div className={styles.headerActions}>
          <button type="button" disabled title="Импорт Excel будет добавлен позже. Сейчас используется подготовленный JSON.">
            Загрузить Excel
          </button>
          <button type="button" disabled>Проверить данные</button>
          <button type="button" disabled>Экспорт JSON</button>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article><strong>{catalogData.summary.totalAssets}</strong><span>Средств защиты</span></article>
        <article><strong>{catalogData.summary.totalLayers}</strong><span>Эшелонов</span></article>
        <article><strong>{coveredOrPartial}</strong><span>Закрыто / частично</span></article>
        <article><strong>{missingLayerCount}</strong><span>Слой без данных</span></article>
        <article><strong>{passiveLayerAssetCount}</strong><span>Пассивная защита</span></article>
        <article><strong>Нет данных</strong><span>Стоимость (CAPEX/OPEX)</span></article>
      </section>

      <section className={styles.mainGrid}>
        <div className={styles.layersWrap}>
          <div className={styles.sectionHead}>
            <h3>Карта 9 эшелонов</h3>
            <span>Нажмите карточку, чтобы отфильтровать каталог</span>
          </div>
          <div className={styles.layersGrid}>
            {layers.map((layer) => {
              const status = statusFromLayer(layer);
              const isActive = selectedLayerId === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  className={`${styles.layerCard} ${isActive ? styles.layerCardActive : ""}`.trim()}
                  onClick={() => onSelectLayer(layer.id)}
                >
                  <div className={styles.layerTopRow}>
                    <strong>Эшелон {layer.number}</strong>
                    <span style={layerStatusStyle(status)}>{defenseLayerStatusLabel[status]}</span>
                  </div>
                  <h4>{layer.name}</h4>
                  <p>{layer.zoneOfAction ?? "Нет данных по зоне"}</p>
                  <div className={styles.layerMeta}>
                    <span>СЗ: {layer.assetCount}</span>
                    <span>{layer.readinessPctFromDashboard === null ? "Нет данных" : `${layer.readinessPctFromDashboard}%`}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <div className={styles.sectionHead}>
            <h3>Таблица средств защиты</h3>
            <span>{filteredAssets.length} из {assets.length}</span>
          </div>

          <div className={styles.filtersRow}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск по названию"
              aria-label="Поиск по названию"
            />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Фильтр по категории">
              <option value="all">Все категории</option>
              {categoryOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select
              value={modelFilter}
              onChange={(event) => setModelFilter(event.target.value as ModelFilter)}
              aria-label="Фильтр по модели"
            >
              <option value="all">3D-модель: все</option>
              <option value="with">Только с моделью</option>
              <option value="without">Без модели</option>
            </select>
            <select
              value={scoreFilter}
              onChange={(event) => setScoreFilter(event.target.value as ValueFilter)}
              aria-label="Фильтр по оценке"
            >
              <option value="all">Оценка: все</option>
              <option value="with">Только с оценкой</option>
              <option value="without">Без оценки</option>
            </select>
            <select
              value={quantityFilter}
              onChange={(event) => setQuantityFilter(event.target.value as ValueFilter)}
              aria-label="Фильтр по количеству"
            >
              <option value="all">Количество: все</option>
              <option value="with">Только с количеством</option>
              <option value="without">Без количества</option>
            </select>
            <button type="button" onClick={resetFilters}>Сбросить</button>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.assetsTable}>
              <thead>
                <tr>
                  <th>Средство защиты</th>
                  <th>Эшелон</th>
                  <th>Категория</th>
                  <th>Зона действия</th>
                  <th>Канал поставки</th>
                  <th>Локализация</th>
                  <th>Количество</th>
                  <th>Оценка</th>
                  <th>3D-модель</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const active = selectedAssetId === asset.id;
                  return (
                    <tr
                      key={asset.id}
                      className={active ? styles.assetRowActive : ""}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        setSelectedLayerId(asset.defenseLayerIds[0] ?? null);
                      }}
                    >
                      <td>{asset.name}</td>
                      <td>{asset.layerNumber}</td>
                      <td>{asset.category}</td>
                      <td>{asset.coverage.zoneOfAction ?? "—"}</td>
                      <td>{formatScore(asset.supplyChannelScore)}</td>
                      <td>{formatScore(asset.localizationScore)}</td>
                      <td>{formatScore(asset.quantityOnSite)}</td>
                      <td>{formatScore(asset.score1to10)}</td>
                      <td>{asset.visualization.modelUrl ? "Есть" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <aside className={styles.detailsWrap}>
          <div className={styles.sectionHead}>
            <h3>Детали</h3>
            <span>{selectedAsset ? "Средство защиты" : detailLayer ? "Эшелон" : "Не выбрано"}</span>
          </div>

          <div className={styles.detailContent}>
            {selectedAsset ? (
              <div className={styles.detailCard}>
                <h4>{selectedAsset.name}</h4>
                <p>Эшелон: {selectedAsset.layerNumber}</p>
                <div className={styles.detailRows}>
                  <div><span>Категория</span><strong>{selectedAsset.category}</strong></div>
                  <div><span>Excel строка</span><strong>{selectedAsset.source.excelRow}</strong></div>
                  <div><span>Канал поставки</span><strong>{formatScore(selectedAsset.supplyChannelScore)}</strong></div>
                  <div><span>Локализация</span><strong>{formatScore(selectedAsset.localizationScore)}</strong></div>
                  <div><span>Количество</span><strong>{formatScore(selectedAsset.quantityOnSite)}</strong></div>
                  <div><span>Оценка 1–10</span><strong>{formatScore(selectedAsset.score1to10)}</strong></div>
                  <div><span>3D-модель</span><strong>{selectedAsset.visualization.modelUrl ? "Назначена" : "Нет"}</strong></div>
                </div>
                <div className={styles.previewBlock}>
                  <h5>3D-preview</h5>
                  <Asset3DPreview asset={selectedAsset} />
                </div>
              </div>
            ) : detailLayer ? (
              <div className={styles.detailCard}>
                <h4>Эшелон {detailLayer.number}: {detailLayer.name}</h4>
                <p>{detailLayer.description}</p>
                <div className={styles.detailRows}>
                  <div><span>Зона действия</span><strong>{detailLayer.zoneOfAction ?? "Нет данных"}</strong></div>
                  <div><span>Готовность</span><strong>{detailLayer.readinessPctFromDashboard === null ? "Нет данных в Excel" : `${detailLayer.readinessPctFromDashboard}%`}</strong></div>
                  <div><span>Статус</span><strong>{defenseLayerStatusLabel[statusFromLayer(detailLayer)]}</strong></div>
                  <div><span>Количество средств</span><strong>{detailLayer.assetCount}</strong></div>
                  <div><span>Роль визуализации</span><strong>{detailLayer.visualRole}</strong></div>
                  <div><span>Тип покрытия</span><strong>{detailLayer.coverageType}</strong></div>
                </div>
                <h5>Средства эшелона</h5>
                <ul className={styles.assetListInline}>
                  {assets.filter((asset) => asset.defenseLayerIds.includes(detailLayer.id)).map((asset) => (
                    <li key={asset.id}>{asset.name}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className={styles.emptyState}>Выберите эшелон или средство защиты для просмотра деталей.</div>
            )}
          </div>

          <div className={styles.insightWrap}>
            <div className={styles.insightTabs}>
              <button
                type="button"
                className={insightView === "hex" ? styles.insightTabActive : styles.insightTab}
                onClick={() => setInsightView("hex")}
              >
                Мини-гексокарта
              </button>
              <button
                type="button"
                className={insightView === "matrix" ? styles.insightTabActive : styles.insightTab}
                onClick={() => setInsightView("matrix")}
              >
                Матрица
              </button>
            </div>

            {insightView === "matrix" ? (
              <article className={styles.matrixWrap}>
                <div className={styles.sectionHead}>
                  <h3>Матрица эффективности</h3>
                  <span>Нет данных в Excel</span>
                </div>
                <div className={styles.matrixState}>Матрица не заполнена в Excel.</div>
                <div className={styles.tableScroll}>
                  <table className={styles.matrixTable}>
                    <thead>
                      <tr>
                        <th>Тип угрозы</th>
                        {layers.map((layer) => (
                          <th key={`layer-col-${layer.id}`}>Э{layer.number}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {THREAT_TYPES.map((threat) => (
                        <tr key={threat.id}>
                          <td>{threat.name}</td>
                          {layers.map((layer) => (
                            <td key={`${threat.id}-${layer.id}`}>—</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ) : (
              <article className={styles.hexPreviewWrap}>
                <div className={styles.sectionHead}>
                  <h3>Мини-гексокарта</h3>
                  <span>{selectedLayer ? `Эшелон ${selectedLayer.number}` : "Выберите эшелон"}</span>
                </div>
                <svg viewBox="-95 -90 190 180" className={styles.hexSvg} role="img" aria-label="Мини гексокарта эшелонов">
                  {HEX_CELLS.map((cell) => {
                    const intensity = layerBandIntensity(selectedLayer?.number ?? null, cell.distance);
                    const activeColor = selectedLayer ? defenseLayerStatusColor[statusFromLayer(selectedLayer)] : "#8ba0b9";
                    const fill = selectedLayer ? activeColor : "#dce7f5";
                    const opacity = selectedLayer ? 0.14 + intensity * 0.78 : 0.32;
                    return (
                      <polygon
                        key={cell.id}
                        points={hexPath(cell.x, cell.y, HEX_RADIUS * 0.92)}
                        fill={fill}
                        fillOpacity={opacity}
                        stroke="#b6c8de"
                        strokeOpacity={0.65}
                        strokeWidth={0.9}
                      />
                    );
                  })}
                  <circle cx="0" cy="0" r="4.5" fill="#24476e" />
                </svg>
              </article>
            )}
          </div>
        </aside>
      </section>
    </section>
  );
}
