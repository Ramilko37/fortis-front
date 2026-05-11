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
import {
  cloneScenario,
  kindLabel,
  objectDefaultsByKind,
  scenarioStats,
  threatStatusColor,
  threatStatusLabel,
  type CameraPresetId,
  type ObjectKind,
  type ScenarioId,
  type SceneObject,
  type ThreatStatus,
} from "./types";
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

export function DroneDefensePrototype() {
  const [objects, setObjects] = useState<SceneObject[]>(() => cloneScenario("baseline"));
  const [plantObjects] = useState<PlantMapObject[]>(() =>
    defaultPlantMapObjects.map((item) => ({ ...item, selectable: item.layer === "protection" })),
  );
  const [plantConnections, setPlantConnections] = useState<PlantMapConnection[]>(() => defaultPlantConnections);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const theme = "dark" as const;
  const [scenario, setScenario] = useState<ScenarioId>("baseline");
  const [demoMode, setDemoMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("scene3d");
  const [autoDemoRunning, setAutoDemoRunning] = useState(false);
  const [cameraPresetRequest, setCameraPresetRequest] = useState<CameraPresetRequest>({ id: "overview", nonce: 0 });
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [idCounter, setIdCounter] = useState(100);
  const [placingKind, setPlacingKind] = useState<ObjectKind | null>(null);
  const [placementPoint, setPlacementPoint] = useState<[number, number, number]>([0, 0, 0]);
  const autoDemoTimers = useRef<number[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  const selectedObject = useMemo(() => objects.find((item) => item.id === selectedId) ?? null, [objects, selectedId]);
  const selectedPlantObject = useMemo(
    () => plantObjects.find((item) => item.id === selectedId && item.selectable) ?? null,
    [plantObjects, selectedId],
  );

  const stats = scenarioStats[scenario];

  const requestCameraPreset = useCallback((id: CameraPresetId) => {
    setCameraPresetRequest((prev) => ({ id, nonce: prev.nonce + 1 }));
  }, []);

  const clearAutoDemoTimers = useCallback(() => {
    autoDemoTimers.current.forEach((timer) => window.clearTimeout(timer));
    autoDemoTimers.current = [];
  }, []);

  const stopAutoDemo = useCallback(() => {
    clearAutoDemoTimers();
    setAutoDemoRunning(false);
  }, [clearAutoDemoTimers]);

  const updateObjectPosition = (id: string, x: number, z: number) => {
    setObjects((prev) =>
      prev.map((item) => (item.id === id ? { ...item, position: [x, item.position[1], z] } : item)),
    );
  };

  const applyScenario = useCallback((id: ScenarioId) => {
    const next = cloneScenario(id);
    setScenario(id);
    setObjects(next);
    setSelectedId(null);
    setPlacingKind(null);
  }, []);

  const applyScenarioManually = (id: ScenarioId) => {
    stopAutoDemo();
    setDemoMode(false);
    applyScenario(id);
  };

  const buildObject = (kind: ObjectKind, position: [number, number, number], nextCounter: number): SceneObject => {
    const count = objects.filter((item) => item.kind === kind).length + 1;
    const defaults = objectDefaultsByKind[kind];
    return {
      id: `${kind}-${nextCounter}`,
      kind,
      label: `${kindLabel[kind]} ${String(count).padStart(2, "0")}`,
      position,
      radius: defaults.coverageRadiusM,
      coverageRadiusM: defaults.coverageRadiusM,
      elevation: defaults.elevation,
      zones: defaults.zones,
      assignment: "Сетка Альфа",
      defenseRole: defaults.defenseRole,
      costMln: defaults.costMln,
      effectiveness: defaults.effectiveness,
    };
  };

  const addObjectAtPosition = (kind: ObjectKind, position: [number, number, number]) => {
    const nextCounter = idCounter + 1;
    const next = buildObject(kind, position, nextCounter);
    setObjects((prev) => [...prev, next]);
    setIdCounter(nextCounter);
    setSelectedId(next.id);
    setIsPropertiesOpen(true);
    messageApi.success(`${kindLabel[kind]} добавлен на карту`);
  };

  const startPlacing = (kind: ObjectKind) => {
    stopAutoDemo();
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
    setObjects((prev) => prev.filter((item) => item.id !== selectedId));
    setPlantConnections((prev) =>
      prev.filter((item) => item.fromObjectId !== selectedId && item.toObjectId !== selectedId),
    );
    setSelectedId(null);
    const removedLabel = objectToDelete.label;
    messageApi.info(`${removedLabel} удален`);
  }, [messageApi, objects, selectedId]);

  const duplicateSelected = () => {
    if (!selectedObject) return;
    const nextCounter = idCounter + 1;
    const copy: SceneObject = {
      ...selectedObject,
      id: `${selectedObject.kind}-${nextCounter}`,
      label: `${selectedObject.label} (копия)`,
      position: [selectedObject.position[0] + 14, 0, selectedObject.position[2] + 12],
    };
    setObjects((prev) => [...prev, copy]);
    setIdCounter(nextCounter);
    setSelectedId(copy.id);
    setIsPropertiesOpen(true);
  };

  const scheduleAutoStep = useCallback((delayMs: number, step: () => void) => {
    const timer = window.setTimeout(step, delayMs);
    autoDemoTimers.current.push(timer);
  }, []);

  const startAutoDemo = useCallback(() => {
    clearAutoDemoTimers();
    setAutoDemoRunning(true);
    setSelectedId(null);
    setPlacingKind(null);
    applyScenario("baseline");
    setDemoMode(false);
    requestCameraPreset("overview");
    messageApi.info("Автодемо: базовая защита и обзор площадки");

    scheduleAutoStep(5000, () => {
      applyScenario("unprotected");
      requestCameraPreset("overview");
      setDemoMode(true);
      messageApi.warning("Этап 1: атака без защитного контура");
    });

    scheduleAutoStep(22000, () => {
      applyScenario("baseline");
      requestCameraPreset("tanks");
      setDemoMode(true);
      messageApi.info("Этап 2: базовая защита отражает 4 из 6 угроз");
    });

    scheduleAutoStep(43000, () => {
      applyScenario("perimeter");
      requestCameraPreset("perimeter");
      setDemoMode(true);
      messageApi.success("Этап 3: усиленный периметр нейтрализует все маршруты");
    });

    scheduleAutoStep(65000, () => {
      requestCameraPreset("operator");
      messageApi.success("Финал: остаточный риск снижен до 12%");
    });

    scheduleAutoStep(75000, () => {
      setAutoDemoRunning(false);
    });
  }, [applyScenario, clearAutoDemoTimers, messageApi, requestCameraPreset, scheduleAutoStep]);

  const toggleAutoDemo = () => {
    if (autoDemoRunning) {
      stopAutoDemo();
      messageApi.info("Автодемо остановлено");
      return;
    }
    startAutoDemo();
  };

  const onViewModeChange = (mode: ViewMode) => {
    if (mode === viewMode) return;
    stopAutoDemo();
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
        stopAutoDemo();
        setPlacingKind(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stopAutoDemo]);

  useEffect(() => () => clearAutoDemoTimers(), [clearAutoDemoTimers]);

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
        autoDemoRunning={autoDemoRunning}
        onScenarioReset={() => applyScenarioManually(scenario)}
        onToggleDemo={() => {
          stopAutoDemo();
          setDemoMode((prev) => !prev);
        }}
        onToggleAutoDemo={toggleAutoDemo}
      />
    </main>
  );
}
