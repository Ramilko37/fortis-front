"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CompassOutlined,
  ControlOutlined,
  DragOutlined,
  EyeOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { message } from "antd";
import type { Configuration, DefenseAssetKind, DefenseScenarioId, Placement } from "@/shared/types/drone-defense";
import {
  kindLabel,
  scenarioStats,
  threatStatusColor,
  threatStatusLabel,
  type CameraPresetId,
  type ObjectKind,
  type SceneObject,
  type ThreatStatus,
} from "../domain/prototype-types";
import {
  isLocalPlacementId,
  localPlacementFromSceneObject,
  sceneObjectsFromConfiguration,
} from "../domain/configuration-scene-mapper";
import { defaultPlantConnections, defaultPlantMapObjects, type PlantMapConnection, type PlantMapObject } from "./plant-map";
import { PrototypeScene } from "./scene";
import { Topbar } from "./topbar";
import { AssetsPanel } from "./assets-panel";
import { PropertiesPanel } from "./properties-panel";
import { StatusBar } from "./status-bar";
import styles from "./drone-defense-prototype.module.css";

type CameraPresetRequest = {
  id: CameraPresetId;
  nonce: number;
};

const cameraPresetLabels: Record<CameraPresetId, string> = {
  overview: "Общий вид",
  perimeter: "Периметр",
  tanks: "Резервуары",
  operator: "Операторная",
};

const threatStatusSequence: ThreatStatus[] = ["detected", "tracking", "neutralized", "breach"];
type ViewMode = "scene3d" | "hex";

const viewModeLabels: Record<ViewMode, string> = {
  scene3d: "3D-карта",
  hex: "Гексокарта",
};

export function FacilityDrilldown({
  facilityName,
  scenario,
  configuration,
  onScenarioChange,
  onLocalPlacementUpsert,
  onLocalPlacementMove,
  onLocalPlacementRemove,
}: {
  facilityName: string;
  scenario: DefenseScenarioId;
  configuration: Configuration;
  onScenarioChange: (scenarioId: DefenseScenarioId) => void;
  onLocalPlacementUpsert: (placement: Placement) => void;
  onLocalPlacementMove: (args: { placementId: string; x: number; z: number }) => void;
  onLocalPlacementRemove: (placementId: string) => void;
}) {
  const [plantObjects] = useState<PlantMapObject[]>(() =>
    defaultPlantMapObjects.map((item) => ({ ...item, selectable: item.layer === "protection" })),
  );
  const [plantConnections, setPlantConnections] = useState<PlantMapConnection[]>(() => defaultPlantConnections);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme = "dark" as const;
  const [demoMode, setDemoMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("scene3d");
  const [cameraPresetRequest, setCameraPresetRequest] = useState<CameraPresetRequest>({ id: "overview", nonce: 0 });
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [placingKind, setPlacingKind] = useState<DefenseAssetKind | null>(null);
  const [placementPoint, setPlacementPoint] = useState<[number, number, number]>([0, 0, 0]);
  const localPlacementSeqRef = useRef(0);
  const [messageApi, contextHolder] = message.useMessage();
  const objects = useMemo(() => sceneObjectsFromConfiguration(configuration), [configuration]);

  const selectedObject = useMemo(() => objects.find((item) => item.id === selectedId) ?? null, [objects, selectedId]);
  const selectedPlantObject = useMemo(
    () => plantObjects.find((item) => item.id === selectedId && item.selectable) ?? null,
    [plantObjects, selectedId],
  );

  const stats = scenarioStats[scenario];

  const requestCameraPreset = useCallback((id: CameraPresetId) => {
    setCameraPresetRequest((prev) => ({ id, nonce: prev.nonce + 1 }));
  }, []);

  const updateObjectPosition = (id: string, x: number, z: number) => {
    const moved = objects.find((item) => item.id === id);
    if (!moved || !isLocalPlacementId(moved.id)) return;
    onLocalPlacementMove({ placementId: moved.id, x, z });
  };

  const addObjectAtPosition = (kind: ObjectKind, position: [number, number, number]) => {
    const nextObject: SceneObject = {
      id: `local-${scenario}-${kind}-${Date.now()}-${localPlacementSeqRef.current++}`,
      kind,
      label: `${kindLabel[kind]} (локально)`,
      position,
      radius: 120,
      coverageRadiusM: 120,
      elevation: 10,
      zones: 1,
      assignment: "Локально добавлено",
      defenseRole: "mesh",
      costMln: 16,
      effectiveness: 0.72,
    };
    setSelectedId(nextObject.id);
    setIsPropertiesOpen(true);
    const placement = localPlacementFromSceneObject(nextObject, configuration.facilityId, scenario);
    if (placement) {
      onLocalPlacementUpsert(placement);
    }
    messageApi.success(`${kindLabel[kind]} добавлен на карту`);
  };

  const startPlacing = (kind: DefenseAssetKind) => {
    setDemoMode(false);
    setPlacingKind(kind);
    setSelectedId(null);
    messageApi.info(`Режим размещения: ${kindLabel[kind]}`);
  };

  const placePendingObject = () => {
    if (!placingKind) return;
    addObjectAtPosition(placingKind, placementPoint);
    setPlacingKind(null);
  };

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    const objectToDelete = objects.find((item) => item.id === selectedId);
    if (!objectToDelete) return;
    if (!isLocalPlacementId(objectToDelete.id)) {
      messageApi.info("Базовые элементы удалять нельзя. Доступно удаление только локально добавленных.");
      return;
    }
    setPlantConnections((prev) =>
      prev.filter((item) => item.fromObjectId !== selectedId && item.toObjectId !== selectedId),
    );
    onLocalPlacementRemove(objectToDelete.id);
    setSelectedId(null);
    const removedLabel = objectToDelete.label;
    messageApi.info(`${removedLabel} удален`);
  }, [messageApi, objects, onLocalPlacementRemove, selectedId]);

  const duplicateSelected = () => {
    if (!selectedObject) return;
    const copy: SceneObject = {
      ...selectedObject,
      id: `local-${scenario}-${selectedObject.kind}-${Date.now()}-${localPlacementSeqRef.current++}`,
      label: `${selectedObject.label} (копия)`,
      position: [selectedObject.position[0] + 14, 0, selectedObject.position[2] + 12],
      assignment: "Локально добавлено",
    };
    setSelectedId(copy.id);
    setIsPropertiesOpen(true);
    const placement = localPlacementFromSceneObject(copy, configuration.facilityId, scenario);
    if (placement) {
      onLocalPlacementUpsert(placement);
    }
  };

  const onViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    setDemoMode(false);
    setPlacingKind(null);
    setViewMode(mode);
    if (mode === "hex") {
      messageApi.info("Гексокарта: размещение и покрытие по ячейкам");
      return;
    }
    requestCameraPreset("overview");
    messageApi.info("3D-карта: возвращен детальный режим площадки");
  };

  const applyScenarioManually = (id: DefenseScenarioId) => {
    setDemoMode(false);
    setPlacingKind(null);
    onScenarioChange(id);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTypingTarget = tagName === "input" || tagName === "textarea" || target?.isContentEditable;
      if (isTypingTarget) return;
      if (!selectedId) return;
      event.preventDefault();
      deleteSelected();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelected, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlacingKind(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className={`${styles.page} ${styles.pageDark}`.trim()}>
      {contextHolder}

      <Topbar
        scenario={scenario}
        onScenarioChange={applyScenarioManually}
      />
      <section className={`${styles.workspace} ${!isPropertiesOpen ? styles.workspaceNoProperties : ""}`.trim()}>
        <AssetsPanel
          onSelectAsset={startPlacing}
          placingKind={placingKind}
          onCancelPlacement={() => setPlacingKind(null)}
        />

        <section className={styles.sceneShell} aria-label="Карта промышленной площадки">
          <PrototypeScene
            objects={objects}
            plantObjects={plantObjects}
            plantConnections={plantConnections}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            updateObjectPosition={updateObjectPosition}
            demoMode={demoMode}
            scenario={scenario}
            theme={theme}
            viewMode={viewMode}
            placingKind={placingKind}
            placementPoint={placementPoint}
            cameraPresetRequest={cameraPresetRequest}
            onPlacementMove={(x, z) => setPlacementPoint([x, 0, z])}
            onPlacePending={placePendingObject}
            onCancelPlacement={() => setPlacingKind(null)}
          />
          <div className={styles.sceneVignette} />
          <div className={styles.sceneModeTabs} aria-label="Режим карты">
            {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                className={viewMode === mode ? styles.sceneModeTabActive : styles.sceneModeTab}
                onClick={() => onViewModeChange(mode)}
              >
                {viewModeLabels[mode]}
              </button>
            ))}
          </div>
          {viewMode === "scene3d" ? (
            <div className={styles.cameraPresetBar} aria-label="Ракурсы камеры">
              {(Object.keys(cameraPresetLabels) as CameraPresetId[]).map((id) => (
                <button key={id} type="button" onClick={() => requestCameraPreset(id)}>
                  <EyeOutlined />
                  {cameraPresetLabels[id]}
                </button>
              ))}
            </div>
          ) : null}
          {demoMode ? (
            <div className={styles.simulationStatusPanel} aria-label="Статусы угроз">
              <span>Статусы угроз</span>
              {threatStatusSequence.map((status) => (
                <strong key={status}>
                  <i style={{ backgroundColor: threatStatusColor[status] }} />
                  {threatStatusLabel[status]}
                </strong>
              ))}
            </div>
          ) : null}
          <div className={styles.configurationBadge} aria-label="Конфигурация">
            <span>{facilityName}</span>
            <strong>{configuration.placements.length} placements</strong>
          </div>
          <div className={styles.controlLegend}>
            <span><CompassOutlined /> {viewMode === "hex" ? "Обзор ЛКМ" : "Орбита ЛКМ"}</span>
            <span><DragOutlined /> {viewMode === "hex" ? "Смещение ПКМ" : "Панорама ПКМ"}</span>
            <span><SearchOutlined /> {viewMode === "hex" ? "Масштаб колёсом" : "Масштаб колесом"}</span>
            <span><ControlOutlined /> {viewMode === "hex" ? "Привязка к гексам" : "Перемещение объектов"}</span>
          </div>
        </section>

        {isPropertiesOpen ? (
          <PropertiesPanel
            selectedObject={selectedObject}
            selectedPlantObject={selectedPlantObject}
            scenario={scenario}
            onDuplicate={duplicateSelected}
            onDelete={deleteSelected}
            onClose={() => setIsPropertiesOpen(false)}
          />
        ) : null}
      </section>

      <StatusBar
        stats={stats}
        scenario={scenario}
        demoMode={demoMode}
        onScenarioReset={() => applyScenarioManually(scenario)}
        onToggleDemo={() => {
          setDemoMode((prev) => !prev);
        }}
      />
    </main>
  );
}
