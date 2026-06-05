"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppstoreOutlined } from "@ant-design/icons";
import { useDefenseStudioStore, studioPreviewData } from "@/modules/drone-defense/domain/use-defense-studio-store";
import { buildEchelonMapModel, type EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import { placedObjectsToMapPlacements } from "@/modules/drone-defense/domain/project-map-adapter";
import { DefenseToolsPanel } from "@/modules/drone-defense/ui/defense-tools-panel";
import { FacilityDrilldown } from "@/modules/drone-defense/ui/facility-drilldown";
import { GisBoard } from "@/modules/drone-defense/ui/gis-board";
import {
  calculateLayerConflicts,
  calculateLayerSummaries,
  findLayerInsertOptions,
  getAssetCatalogItems,
  getLayerRadii,
  priceForPlacedObject,
  validateLayerGeometry,
} from "@/shared/lib/defense-project";
import { MAX_DEFENSE_PROJECT_LAYERS, useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { DefenseAssetCategory, DefenseProject, EditableDefenseLayer } from "@/shared/types/defense-project";
import type { LayerInsertOption } from "@/shared/lib/defense-project";
import type { DefenseLayer, DefenseLayerId } from "@/shared/types/drone-defense";
import type { PointerEvent as ReactPointerEvent } from "react";

type CatalogFilter =
  | "all"
  | "recommended"
  | "detection"
  | "suppression"
  | "fire"
  | "passive"
  | "infrastructure"
  | "software"
  | "placed";

const catalogFilterCategories: Partial<Record<CatalogFilter, DefenseAssetCategory[]>> = {
  detection: ["detection"],
  suppression: ["jamming", "spoofing"],
  fire: ["kinetic", "interceptor"],
  passive: ["passive-protection", "engineering-protection"],
  infrastructure: ["early-warning", "infrastructure", "command-center"],
  software: ["software", "classification", "external-service"],
};

function formatDistance(meters: number) {
  if (meters >= 1000) return `${(meters / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} км`;
  return `${meters.toLocaleString("ru-RU")} м`;
}

function projectLayerToMapLayer(layer: EditableDefenseLayer): DefenseLayer {
  const radii = getLayerRadii(layer);
  return {
    id: layer.id as DefenseLayer["id"],
    order: layer.order,
    name: layer.name,
    shortName: layer.code,
    defaultWeight: 0.1,
    color: layer.color,
    opacity: layer.opacity,
    distanceBandM: {
      min: radii.innerRadiusM,
      max: radii.outerRadiusM,
      label: `${formatDistance(radii.innerRadiusM)}-${formatDistance(radii.outerRadiusM)}`,
    },
  };
}

type LayerWizardDraft = {
  name: string;
  code: string;
  innerRadiusM: number;
  widthM: number;
};

type LayerWizardState = {
  mode: "create" | "edit";
  layerId?: string;
  insertPosition?: string;
  draft: LayerWizardDraft;
};

function formatWizardRange(option: LayerInsertOption) {
  const max = option.maxOuterRadiusM === null ? "∞" : formatDistance(option.maxOuterRadiusM);
  return `${formatDistance(option.minInnerRadiusM)}-${max}`;
}

function layerInsertOptionKey(option: LayerInsertOption) {
  if (option.kind === "between") return `between:${option.beforeLayerId}:${option.afterLayerId}`;
  return option.kind;
}

function buildWizardLayer(
  project: DefenseProject,
  draft: LayerWizardDraft,
  baseLayer?: EditableDefenseLayer,
): EditableDefenseLayer {
  const innerRadiusM = Number.isFinite(draft.innerRadiusM) ? draft.innerRadiusM : 0;
  const widthM = Number.isFinite(draft.widthM) ? draft.widthM : 0;
  const outerRadiusM = innerRadiusM + widthM;
  return {
    ...(baseLayer ?? {
      id: "__layer_preview__",
      order: project.layers.length + 1,
      description: "Предпросмотр",
      geometryType: "ring" as const,
      isActive: false,
      isVisible: true,
      isLocked: false,
    }),
    name: draft.name.trim() || "Новый эшелон",
    code: draft.code.trim() || `L${project.layers.length + 1}`,
    distanceFromObjectMin: innerRadiusM,
    distanceFromObjectMax: outerRadiusM,
    geometryType: "ring",
    geometry: {
      type: "ring",
      center: project.baseObject.center,
      minRadiusM: innerRadiusM,
      maxRadiusM: outerRadiusM,
    },
    color: "#0ea5e9",
    opacity: 0.2,
  };
}

export function DroneDefensePrototype() {
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogFilter, setCatalogFilter] = useState<CatalogFilter>("all");
  const [isCatalogTrayOpen, setIsCatalogTrayOpen] = useState(true);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isLayerPanelExpanded, setIsLayerPanelExpanded] = useState(true);
  const [layerPanelMode, setLayerPanelMode] = useState<"view" | "edit">("view");
  const [layerWizardState, setLayerWizardState] = useState<LayerWizardState | null>(null);
  const [lastPlacementMessage, setLastPlacementMessage] = useState<string | null>(null);
  const {
    init,
    loading,
    error,
    view,
    facilityId,
    scenarioId,
    configuration: studioConfiguration,
    catalog,
    facilities,
    layers,
    setFacilityId,
    setScenarioId,
    upsertLocalPlacement,
    moveLocalPlacement,
    removeLocalPlacement,
  } = useDefenseStudioStore();
  const {
    project,
    createLayerFromDraft,
    deleteLayer,
    updateLayerGeometry,
    selectLayer,
    setBaseObjectCenter,
    selectAsset,
    selectedObjectId,
    selectObject,
    placeObject,
    transferObjectToLayer,
    updatePlacedObject,
    deletePlacedObject,
    restoreProjectFromLocalStorage,
  } = useDefenseProjectStore();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    restoreProjectFromLocalStorage();
  }, [restoreProjectFromLocalStorage]);

  const selectedFacility = useMemo(
    () => facilities.find((item) => item.id === facilityId) ?? null,
    [facilities, facilityId],
  );

  useEffect(() => {
    if (!selectedFacility) return;
    setBaseObjectCenter({ lat: selectedFacility.center.lat, lng: selectedFacility.center.lon });
  }, [selectedFacility, setBaseObjectCenter]);
  const projectMapLayers = useMemo(
    () =>
      [...project.layers]
        .filter((layer) => layer.isVisible !== false)
        .sort((a, b) => a.order - b.order)
        .map(projectLayerToMapLayer),
    [project.layers],
  );
  const selectedLayerId = project.activeLayerId ?? project.layers[0]?.id ?? "";
  const selectedLayer = useMemo(
    () => project.layers.find((layer) => layer.id === selectedLayerId) ?? project.layers[0],
    [project.layers, selectedLayerId],
  );
  const orderedProjectLayers = useMemo(
    () => [...project.layers].sort((a, b) => a.order - b.order),
    [project.layers],
  );
  const layerSummaries = useMemo(() => calculateLayerSummaries(project), [project]);
  const layerConflicts = useMemo(() => calculateLayerConflicts(project), [project]);
  const conflictObjectIds = useMemo(() => new Set(layerConflicts.map((object) => object.id)), [layerConflicts]);
  const assetCatalogItems = useMemo(
    () => getAssetCatalogItems(project, selectedLayer?.code, project.placedObjects),
    [project, selectedLayer?.code],
  );
  const filteredCatalogItems = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return assetCatalogItems.filter((item) => {
      if (catalogFilter === "placed" && item.placedCount <= 0) return false;
      if (catalogFilter === "recommended" && item.compatibilityStatus !== "recommended") return false;
      const categoryFilter = catalogFilterCategories[catalogFilter];
      if (categoryFilter && !categoryFilter.includes(item.category)) return false;
      if (!query) return true;
      const haystack = [
        item.title,
        item.subtitle,
        item.categoryLabel,
        item.rangeLabel,
        item.priceLabel,
        item.coverageLabel,
        item.compatibilityLabel,
        item.category,
        ...item.roles,
        ...item.tags,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [assetCatalogItems, catalogFilter, catalogQuery]);
  const selectedRadii = selectedLayer ? getLayerRadii(selectedLayer) : { innerRadiusM: 0, widthM: 0, outerRadiusM: 0 };
  const insertOptions = useMemo(() => findLayerInsertOptions(project), [project]);
  const wizardLayer = useMemo(() => {
    if (!layerWizardState) return null;
    const baseLayer =
      layerWizardState.mode === "edit"
        ? project.layers.find((layer) => layer.id === layerWizardState.layerId)
        : undefined;
    return buildWizardLayer(project, layerWizardState.draft, baseLayer);
  }, [layerWizardState, project]);
  const wizardValidation = useMemo(() => {
    if (!layerWizardState || !wizardLayer) return null;
    return validateLayerGeometry(
      project,
      wizardLayer,
      layerWizardState.mode === "edit" ? layerWizardState.layerId : undefined,
    );
  }, [layerWizardState, project, wizardLayer]);
  const wizardConflictCount = useMemo(() => {
    if (!layerWizardState || layerWizardState.mode !== "edit" || !wizardLayer || !layerWizardState.layerId) return 0;
    const editedProject = {
      ...project,
      layers: project.layers.map((layer) => (layer.id === layerWizardState.layerId ? wizardLayer : layer)),
    };
    return calculateLayerConflicts(editedProject, layerWizardState.layerId).length;
  }, [layerWizardState, project, wizardLayer]);
  const previewMapLayer = useMemo(() => {
    if (!wizardLayer) return null;
    return {
      ...projectLayerToMapLayer(wizardLayer),
      id: "__layer_preview__" as DefenseLayer["id"],
      shortName: "PREVIEW",
      name: layerWizardState?.mode === "edit" ? "Предпросмотр изменения" : "Предпросмотр нового эшелона",
      color: "#0ea5e9",
      opacity: 0.22,
    };
  }, [layerWizardState?.mode, wizardLayer]);
  const placementHint = lastPlacementMessage ?? `Эшелон ${selectedLayer?.code ?? "—"} · выберите средство и кликните по карте`;
  const projectCatalogPlacements = useMemo(
    () =>
      placedObjectsToMapPlacements({
        project,
        facilityId,
        scenarioId,
      }).filter((placement) => project.layers.find((layer) => layer.id === placement.layerId)?.isVisible !== false),
    [facilityId, project, scenarioId],
  );
  const localScenePlacements = useMemo(
    () => studioConfiguration.placements.filter((placement) => placement.id.startsWith("local-")),
    [studioConfiguration.placements],
  );
  const mapConfiguration = useMemo(
    () => ({
      ...studioConfiguration,
      placements: [...projectCatalogPlacements, ...localScenePlacements],
    }),
    [localScenePlacements, projectCatalogPlacements, studioConfiguration],
  );
  const echelonModel = useMemo(
    () =>
      buildEchelonMapModel({
        facility: selectedFacility,
        layers: projectMapLayers,
        layerCoverage: layers,
        configuration: mapConfiguration,
        catalog,
        selectedLayerId: selectedLayerId as DefenseLayerId,
        selectedSlotId,
      }),
    [catalog, mapConfiguration, layers, projectMapLayers, selectedFacility, selectedLayerId, selectedSlotId],
  );
  const selectedLayerSlots = useMemo(
    () => echelonModel.slots.filter((slot) => slot.layerId === selectedLayerId),
    [echelonModel.slots, selectedLayerId],
  );
  const selectedLayerObjects = useMemo(
    () => project.placedObjects.filter((object) => object.layerId === selectedLayerId),
    [project.placedObjects, selectedLayerId],
  );
  const selectedLayerSummary = layerSummaries.find((summary) => summary.layerId === selectedLayerId);
  const selectedLayerLocked = Boolean(selectedLayer?.isLocked);
  const canCreateLayer = project.layers.length < MAX_DEFENSE_PROJECT_LAYERS;
  const canDeleteSelectedLayer = project.layers.length > 1 && selectedLayerObjects.length === 0;
  const isLayerEditMode = layerPanelMode === "edit";
  const showCompactLayerPanel = isCatalogTrayOpen || !isLayerPanelExpanded;

  const draftForInsertOption = (option: LayerInsertOption | undefined): Pick<LayerWizardState, "draft" | "insertPosition"> => {
    const innerRadiusM = option?.minInnerRadiusM ?? 0;
    const availableWidthM = option?.availableWidthM ?? Number.POSITIVE_INFINITY;
    const widthM = Number.isFinite(availableWidthM) ? Math.min(Math.max(availableWidthM, 0), 5000) : 5000;
    return {
      insertPosition: option ? layerInsertOptionKey(option) : undefined,
      draft: {
        name: "Новый эшелон",
        code: `L${project.layers.length + 1}`,
        innerRadiusM,
        widthM: Math.max(widthM, 1000),
      },
    };
  };

  const createProjectLayer = () => {
    if (!canCreateLayer) {
      setLastPlacementMessage(`Достигнут максимум: ${MAX_DEFENSE_PROJECT_LAYERS} эшелонов`);
      return;
    }
    const outsideOption = insertOptions.find((option) => option.kind === "outside") ?? insertOptions[0];
    setLayerWizardState({
      mode: "create",
      ...draftForInsertOption(outsideOption),
    });
    setLastPlacementMessage(null);
  };

  const editSelectedLayer = () => {
    if (!selectedLayer) return;
    const radii = getLayerRadii(selectedLayer);
    setLayerWizardState({
      mode: "edit",
      layerId: selectedLayer.id,
      draft: {
        name: selectedLayer.name,
        code: selectedLayer.code,
        innerRadiusM: radii.innerRadiusM,
        widthM: radii.widthM,
      },
    });
    setLastPlacementMessage(null);
  };

  const saveLayerWizard = () => {
    if (!layerWizardState || !wizardValidation?.isValid) return;
    if (layerWizardState.mode === "create") {
      const result = createLayerFromDraft(layerWizardState.draft);
      if (!result.ok) {
        setLastPlacementMessage(result.validation.message ?? "Не удалось создать эшелон");
        return;
      }
      selectLayer(result.layer.id);
      setLastPlacementMessage("Эшелон создан");
      setLayerWizardState(null);
      return;
    }
    if (!layerWizardState.layerId) return;
    const result = updateLayerGeometry(layerWizardState.layerId, {
      innerRadiusM: layerWizardState.draft.innerRadiusM,
      widthM: layerWizardState.draft.widthM,
    });
    if (!result.ok) {
      setLastPlacementMessage(result.validation.message ?? "Не удалось сохранить эшелон");
      return;
    }
    setLastPlacementMessage(
      wizardConflictCount > 0
        ? `Размеры сохранены. ${wizardConflictCount} объект(ов) вне нового кольца.`
        : "Размеры эшелона сохранены",
    );
    setLayerWizardState(null);
  };

  const selectWizardInsertPosition = (positionKey: string) => {
    const option = insertOptions.find((item) => layerInsertOptionKey(item) === positionKey);
    const next = draftForInsertOption(option);
    setLayerWizardState((current) =>
      current
        ? {
            ...current,
            insertPosition: next.insertPosition,
            draft: {
              ...current.draft,
              innerRadiusM: next.draft.innerRadiusM,
              widthM: next.draft.widthM,
            },
          }
        : current,
    );
  };

  const deleteSelectedLayer = () => {
    if (!selectedLayer) return;
    const result = deleteLayer(selectedLayer.id);
    setLastPlacementMessage(result.ok ? "Эшелон удалён" : result.message);
  };

  const selectPlacedObject = (objectId: string) => {
    const object = project.placedObjects.find((item) => item.id === objectId);
    if (!object) return;
    selectObject(objectId);
    setSelectedSlotId(null);
    const asset = project.assetLibrary.find((item) => item.id === object.assetId);
    setLastPlacementMessage(`${asset?.name ?? object.name ?? "Объект"} выбран на карте`);
  };

  const transferPlacedObject = (objectId: string, layerId: string) => {
    const object = project.placedObjects.find((item) => item.id === objectId);
    const targetLayer = project.layers.find((layer) => layer.id === layerId);
    if (!object || !targetLayer) return;
    const validation = transferObjectToLayer(objectId, layerId);
    if (!validation.isValid) {
      setLastPlacementMessage(validation.message ?? "Нельзя перенести объект в выбранный эшелон");
      return;
    }
    setSelectedSlotId(null);
    setLastPlacementMessage(`${object.name ?? "Объект"} перенесён в ${targetLayer.code}`);
  };

  const handleSelectTool = (asset: ReturnType<typeof getAssetCatalogItems>[number]) => {
    const nextId = activeToolId === asset.assetId ? null : asset.assetId;
    setActiveToolId(nextId);
    selectAsset(asset.assetId);
    setLastPlacementMessage(
      nextId
        ? `${selectedLayer?.code ?? "—"} · ${asset.title}: кликните по карте внутри активного эшелона`
        : null,
    );
  };

  const addToolToSlot = (asset: ReturnType<typeof getAssetCatalogItems>[number], slot: EchelonMapSlot | null) => {
    if (!selectedLayer) return;
    setActiveToolId(asset.assetId);
    selectAsset(asset.assetId);

    const targetLayer = slot ? project.layers.find((layer) => layer.id === slot.layerId) ?? selectedLayer : selectedLayer;
    if (slot) {
      selectLayer(slot.layerId);
      setSelectedSlotId(slot.id);
    }

    if (targetLayer.isLocked) {
      setLastPlacementMessage("Эшелон заблокирован для размещения.");
      return;
    }

    if (!slot && asset.placementType !== "non-physical") {
      setLastPlacementMessage(`${asset.title}: выберите точку на карте внутри эшелона ${targetLayer.code}`);
      return;
    }

    const coordinates = slot
      ? { lat: slot.position[1], lng: slot.position[0] }
      : project.baseObject.center;
    const validation = placeObject(asset.assetId, targetLayer.id, coordinates);
    setLastPlacementMessage(
      validation.message ??
        (validation.isValid
          ? `${asset.title} размещено в эшелоне ${targetLayer.code}`
          : "Не удалось разместить объект"),
    );
  };

  const placeActiveToolAtCoordinate = ({ lng, lat }: { lng: number; lat: number }) => {
    if (!activeToolId || !selectedLayer) return;
    if (selectedLayer.isLocked) {
      setLastPlacementMessage("Эшелон заблокирован для размещения.");
      return;
    }
    const asset = project.assetLibrary.find((item) => item.id === activeToolId);
    if (!asset) {
      setLastPlacementMessage("Средство защиты не найдено в библиотеке");
      return;
    }
    selectAsset(asset.id);
    const validation = placeObject(asset.id, selectedLayer.id, { lat, lng });
    setLastPlacementMessage(
      validation.message ??
        (validation.isValid
          ? `${asset.name} размещено в эшелоне ${selectedLayer.code}`
          : "Не удалось разместить объект"),
    );
  };

  const removeCatalogAsset = (assetId: string) => {
    const asset = project.assetLibrary.find((item) => item.id === assetId);
    const placedObject = project.placedObjects.find((object) => object.assetId === assetId);
    if (!placedObject) return;
    deletePlacedObject(placedObject.id);
    setLastPlacementMessage(`${asset?.name ?? "Средство защиты"} удалено из общей конфигурации`);
  };

  const selectLayerWithDefaultSlot = (layerId: string) => {
    selectLayer(layerId);
    setActiveToolId(null);
    setLastPlacementMessage(null);
    const nextSlot =
      echelonModel.slots.find((slot) => slot.layerId === layerId && slot.status === "empty") ??
      echelonModel.slots.find((slot) => slot.layerId === layerId) ??
      null;
    setSelectedSlotId(nextSlot?.id ?? null);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActiveToolId(null);
      setLastPlacementMessage(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <section className="z-10 flex max-h-[42vh] w-full shrink-0 flex-col border-b border-slate-200 bg-white shadow-xl shadow-slate-900/5 lg:h-full lg:max-h-none lg:w-[320px] lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
              <AppstoreOutlined />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-slate-950">Моя карта</h1>
              <p className="truncate text-xs text-slate-500">Defense Configuration Studio</p>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-blue-100 bg-blue-50/95 px-4 py-3 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Активный эшелон</p>
            <p className="mt-0.5 text-sm font-semibold text-blue-950">
              {placementHint}
            </p>
            <button
              type="button"
              className="mt-3 h-9 w-full cursor-pointer rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-700"
              onClick={() => setIsCatalogTrayOpen(true)}
            >
              Открыть библиотеку СЗ
            </button>
          </div>

          <div className="p-4">
            {selectedLayer ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Объекты эшелона</p>
                    <p className="text-sm font-semibold text-slate-950">
                      {selectedLayerObjects.length > 0 ? `${selectedLayerObjects.length} размещено` : "Пока пусто"}
                    </p>
                  </div>
                  {selectedLayerSummary && selectedLayerSummary.conflictCount > 0 ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
                      {selectedLayerSummary.conflictCount} конфликт
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 space-y-2">
                  {selectedLayerObjects.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                      Выберите средство ниже и кликните по карте внутри кольца.
                    </div>
                  ) : (
                    selectedLayerObjects.map((object) => {
                      const asset = project.assetLibrary.find((item) => item.id === object.assetId);
                      const isConflict = conflictObjectIds.has(object.id);
                      const unitPrice = priceForPlacedObject(project, object);
                      return (
                        <div
                          key={object.id}
                          className={`cursor-pointer rounded-lg border p-2 transition ${
                            object.id === selectedObjectId
                              ? "border-blue-400 bg-blue-50 shadow-sm shadow-blue-600/10"
                              : isConflict
                                ? "border-amber-200 bg-amber-50"
                                : "border-slate-200 bg-slate-50 hover:border-blue-200"
                          }`}
                          onClick={() => selectPlacedObject(object.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate text-xs font-semibold text-slate-900">{object.name ?? asset?.name ?? object.assetId}</p>
                                {isConflict ? (
                                  <span className="shrink-0 rounded bg-amber-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-800">
                                    conflict
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {unitPrice > 0 ? `${unitPrice} млн/ед.` : "без CAPEX"}
                                {isConflict ? " · вне границ" : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="h-7 cursor-pointer rounded-md border border-rose-200 px-2 text-[10px] font-semibold text-rose-600 hover:bg-rose-50"
                              onClick={(event) => {
                                event.stopPropagation();
                                deletePlacedObject(object.id);
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-[1fr_1fr] gap-2">
                            <input
                              type="number"
                              min={1}
                              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                              value={object.quantity}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => updatePlacedObject(object.id, { quantity: Number(event.target.value) })}
                            />
                            <select
                              className="h-8 cursor-pointer rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                              value={object.status}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => updatePlacedObject(object.id, { status: event.target.value as typeof object.status })}
                            >
                              <option value="planned">planned</option>
                              <option value="active">active</option>
                              <option value="inactive">inactive</option>
                              <option value="maintenance">maintenance</option>
                            </select>
                          </div>
                          <select
                            className="mt-2 h-8 w-full cursor-pointer rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-blue-400"
                            value={object.layerId}
                            onClick={(event) => event.stopPropagation()}
                            onChange={(event) => transferPlacedObject(object.id, event.target.value)}
                          >
                            {orderedProjectLayers.map((layer) => (
                              <option key={layer.id} value={layer.id}>
                                {layer.code} · {layer.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <main className="relative min-w-0 flex-1 overflow-hidden">
        {error ? (
          <div className="absolute left-4 top-4 z-30 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 shadow">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="absolute left-4 top-4 z-30 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow">
            Загрузка данных…
          </div>
        ) : null}

        {view === "gis" ? (
          <>
            <GisBoard
              className="h-full min-h-0 rounded-none border-0"
              facilities={facilities}
              selectedFacilityId={facilityId}
              onSelectFacility={(nextId) => void setFacilityId(nextId)}
              hexCells={studioPreviewData.hexCells}
              threatRoutes={studioPreviewData.threatRoutes}
              layers={layers}
              configuration={mapConfiguration}
              catalog={catalog}
              mapLayers={projectMapLayers}
              previewLayer={previewMapLayer}
              selectedLayerId={selectedLayerId}
              selectedSlotId={selectedSlotId}
              activeToolId={activeToolId}
              placementHint={placementHint}
              onSelectLayer={selectLayerWithDefaultSlot}
              onSelectSlot={(slot) => {
                selectLayer(slot.layerId);
                setSelectedSlotId(slot.id);
              }}
              onSelectPlacement={selectPlacedObject}
              onSelectTool={(groupId) => {
                const asset =
                  project.assetLibrary.find((item) => item.id === groupId) ??
                  project.assetLibrary.find((item) => item.mapCatalogGroupIds?.includes(groupId));
                setActiveToolId(asset?.id ?? null);
                setLastPlacementMessage(
                  asset ? `${selectedLayer?.code ?? "—"} · ${asset.name}: кликните по карте` : null,
                );
              }}
              onPlaceActiveTool={placeActiveToolAtCoordinate}
            />

            {selectedLayer ? (
              <div
                className={`pointer-events-none absolute inset-x-3 z-20 flex transition-[bottom] lg:inset-x-5 ${
                  isCatalogTrayOpen ? "bottom-[21.5rem]" : "bottom-3"
                } ${
                  showCompactLayerPanel ? "justify-center" : "justify-start"
                }`}
              >
                <div
                  className={`pointer-events-auto border border-white/70 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur ${
                    showCompactLayerPanel
                      ? "max-w-full overflow-x-auto rounded-lg p-1"
                      : "w-full rounded-xl p-3"
                  }`}
                >
                  {showCompactLayerPanel ? (
                    <div className="flex items-center gap-1">
                      {orderedProjectLayers.map((layer) => {
                        const isSelected = layer.id === selectedLayer.id;
                        return (
                          <button
                            key={layer.id}
                            type="button"
                            className={`h-9 min-w-10 cursor-pointer rounded-md px-2 text-[11px] font-bold transition ${
                              isSelected ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                            }`}
                            onClick={() => selectLayerWithDefaultSlot(layer.id)}
                            title={layer.name}
                          >
                            {layer.code}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className="h-9 cursor-pointer rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                        onClick={() => {
                          setIsCatalogTrayOpen(false);
                          setIsLayerPanelExpanded(true);
                        }}
                        title="Развернуть панель эшелонов"
                      >
                        ↑
                      </button>
                    </div>
                  ) : (
                    <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-blue-500">Эшелоны проекта</p>
                      <p className="text-sm font-semibold text-slate-950">
                        Кольца вокруг объекта · {project.layers.length}/{MAX_DEFENSE_PROJECT_LAYERS}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex h-9 rounded-lg bg-slate-100 p-1">
                        <button
                          type="button"
                          className={`cursor-pointer rounded-md px-3 text-xs font-semibold transition ${
                            layerPanelMode === "view"
                              ? "bg-white text-blue-700 shadow-sm"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                          onClick={() => setLayerPanelMode("view")}
                        >
                          Просмотр
                        </button>
                        <button
                          type="button"
                          className={`cursor-pointer rounded-md px-3 text-xs font-semibold transition ${
                            isLayerEditMode
                              ? "bg-white text-blue-700 shadow-sm"
                              : "text-slate-500 hover:text-slate-900"
                          }`}
                          onClick={() => setLayerPanelMode("edit")}
                        >
                          Редактирование
                        </button>
                      </div>
                      {isLayerEditMode ? (
                        <button
                          type="button"
                          className="h-9 cursor-pointer rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                          onClick={createProjectLayer}
                          disabled={!canCreateLayer}
                          title={canCreateLayer ? "Создать эшелон" : `Максимум ${MAX_DEFENSE_PROJECT_LAYERS} эшелонов`}
                        >
                          + Эшелон
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => setIsLayerPanelExpanded(false)}
                      >
                        Свернуть
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {orderedProjectLayers.map((layer) => {
                      const radii = getLayerRadii(layer);
                      const summary = layerSummaries.find((item) => item.layerId === layer.id);
                      const isSelected = layer.id === selectedLayer.id;
                      return (
                        <div
                          key={layer.id}
                          className={`min-w-[11rem] rounded-lg border p-2 transition ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 shadow-sm shadow-blue-600/10"
                              : "border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50"
                          }`}
                        >
                          <button
                            type="button"
                            className="block w-full cursor-pointer text-left"
                            onClick={() => selectLayerWithDefaultSlot(layer.id)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-slate-950">
                                {layer.code} · {layer.name}
                              </span>
                              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layer.color }} />
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {formatDistance(radii.innerRadiusM)} + {formatDistance(radii.widthM)}
                            </p>
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                              {summary?.objectCount ?? 0} объектов
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                              {summary?.totalMln ?? 0} млн
                            </span>
                            {layer.isLocked ? <span className="rounded bg-slate-900 px-1.5 py-0.5 text-white">locked</span> : null}
                            {layer.isVisible === false ? <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-600">hidden</span> : null}
                            {summary && summary.conflictCount > 0 ? (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700">
                                {summary.conflictCount} conflict
                              </span>
                            ) : null}
                            {isSelected && isLayerEditMode ? (
                              <span className="ml-auto flex items-center gap-1">
                                <button
                                  type="button"
                                  className="cursor-pointer rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-200"
                                  onClick={editSelectedLayer}
                                >
                                  Настроить
                                </button>
                                <button
                                  type="button"
                                  className="cursor-pointer rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={deleteSelectedLayer}
                                  disabled={!canDeleteSelectedLayer}
                                  title={
                                    project.layers.length <= 1
                                      ? "Минимум 1 эшелон"
                                      : selectedLayerObjects.length > 0
                                        ? "В эшелоне есть размещённые объекты. Сначала удалите или перенесите их."
                                        : "Удалить эшелон"
                                  }
                                >
                                  Удалить
                                </button>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedLayerSummary && selectedLayerSummary.conflictCount > 0 ? (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      {selectedLayerSummary.conflictCount} объект(ов) вне новых границ эшелона. Они сохранены, но помечены конфликтом.
                    </div>
                  ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}

            <div
              className={`absolute inset-x-3 bottom-3 z-30 transition-transform duration-200 lg:inset-x-5 ${
                isCatalogTrayOpen ? "translate-y-0" : "translate-y-[calc(100%+0.75rem)]"
              }`}
            >
              <div className="overflow-hidden rounded-xl border border-white/70 bg-white/95 shadow-2xl shadow-slate-900/20 backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Библиотека СЗ</p>
                    <h2 className="truncate text-sm font-semibold text-slate-950">
                      Размещение в {selectedLayer?.code ?? "—"} · {selectedLayer?.name ?? "Эшелон не выбран"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {formatDistance(selectedRadii.innerRadiusM)}-{formatDistance(selectedRadii.outerRadiusM)} от объекта
                    </p>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                    <div className="grid min-w-[16rem] max-w-full flex-1 grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 sm:flex-none lg:grid-cols-5">
                      {[
                        { id: "all", label: "Все" },
                        { id: "recommended", label: "Рекоменд." },
                        { id: "detection", label: "Обнаруж." },
                        { id: "suppression", label: "Подавл." },
                        { id: "fire", label: "Пораж." },
                        { id: "passive", label: "Пассив." },
                        { id: "infrastructure", label: "Инфра" },
                        { id: "software", label: "ПО" },
                        { id: "placed", label: "Размещ." },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`cursor-pointer rounded-md px-2 text-[11px] font-semibold transition ${
                            catalogFilter === item.id
                              ? "bg-white text-blue-700 shadow-sm"
                              : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
                          }`}
                          onClick={() => setCatalogFilter(item.id as CatalogFilter)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                    <input
                      className="h-9 min-w-[13rem] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400 sm:max-w-[18rem]"
                      value={catalogQuery}
                      onChange={(event) => setCatalogQuery(event.target.value)}
                      placeholder="Найти средство..."
                    />
                    <button
                      type="button"
                      className="h-9 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      onClick={() => setIsCatalogTrayOpen(false)}
                    >
                      Свернуть
                    </button>
                  </div>
                </div>
                <div className="max-h-[15.5rem] overflow-y-auto p-3">
                  <DefenseToolsPanel
                    assets={filteredCatalogItems}
                    projectAssets={project.assetLibrary}
                    slots={selectedLayerLocked ? [] : selectedLayerSlots}
                    placements={mapConfiguration.placements}
                    selectedToolId={activeToolId}
                    onSelectTool={handleSelectTool}
                    onAddTool={addToolToSlot}
                    onRemoveTool={(asset) => removeCatalogAsset(asset.assetId)}
                  />
                </div>
              </div>
            </div>

            {!isCatalogTrayOpen ? (
              <button
                type="button"
                className="absolute bottom-3 right-3 z-40 h-10 cursor-pointer rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-700 lg:right-5"
                onClick={() => setIsCatalogTrayOpen(true)}
              >
                Библиотека СЗ
              </button>
            ) : null}
          </>
        ) : null}

        {view === "drilldown" ? (
          <div className="h-full overflow-auto bg-slate-50 p-4">
            <FacilityDrilldown
              key={`${facilityId}:${scenarioId}`}
              facilityName={selectedFacility?.name ?? "Facility"}
              scenario={scenarioId}
              configuration={mapConfiguration}
              onScenarioChange={(nextScenarioId) => void setScenarioId(nextScenarioId)}
              onLocalPlacementUpsert={(placement) => void upsertLocalPlacement(placement)}
              onLocalPlacementMove={(args) => void moveLocalPlacement(args)}
              onLocalPlacementRemove={(placementId) => void removeLocalPlacement(placementId)}
            />
          </div>
        ) : null}

        {layerWizardState ? (
          <LayerGeometryWizard
            state={layerWizardState}
            insertOptions={insertOptions}
            validationMessage={wizardValidation?.message}
            isValid={Boolean(wizardValidation?.isValid)}
            conflictCount={wizardConflictCount}
            onSelectInsertPosition={selectWizardInsertPosition}
            onDraftChange={(patch) =>
              setLayerWizardState((current) =>
                current
                  ? {
                      ...current,
                      draft: { ...current.draft, ...patch },
                    }
                  : current,
              )
            }
            onCancel={() => setLayerWizardState(null)}
            onSubmit={saveLayerWizard}
          />
        ) : null}
      </main>
    </div>
  );
}

type LayerGeometryWizardProps = {
  state: LayerWizardState;
  insertOptions: LayerInsertOption[];
  validationMessage?: string;
  isValid: boolean;
  conflictCount: number;
  onSelectInsertPosition: (positionKey: string) => void;
  onDraftChange: (patch: Partial<LayerWizardDraft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

function metersToKilometers(value: number) {
  return Number((value / 1000).toFixed(2));
}

function kilometersToMeters(value: string) {
  const numeric = Number(value.replace(",", "."));
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) : 0;
}

function LayerGeometryWizard({
  state,
  insertOptions,
  validationMessage,
  isValid,
  conflictCount,
  onSelectInsertPosition,
  onDraftChange,
  onCancel,
  onSubmit,
}: LayerGeometryWizardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const outerRadiusM = state.draft.innerRadiusM + state.draft.widthM;

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const card = cardRef.current;
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const padding = 12;
      const maxX = Math.max(padding, window.innerWidth - rect.width - padding);
      const maxY = Math.max(padding, window.innerHeight - rect.height - padding);
      const nextX = Math.min(maxX, Math.max(padding, event.clientX - dragOffsetRef.current.x));
      const nextY = Math.min(maxY, Math.max(padding, event.clientY - dragOffsetRef.current.y));
      setDragPosition({ x: nextX, y: nextY });
    };

    const handlePointerUp = () => setIsDragging(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
    window.addEventListener("pointercancel", handlePointerUp, { once: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging]);

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    setDragPosition({ x: rect.left, y: rect.top });
    setIsDragging(true);
    event.preventDefault();
  };

  return (
    <div
      className={`pointer-events-none z-40 ${
        dragPosition ? "fixed left-0 top-0" : "absolute inset-x-3 bottom-3 flex justify-center lg:inset-x-5"
      }`}
    >
      <div
        ref={cardRef}
        className="pointer-events-auto w-full max-w-3xl rounded-xl border border-slate-200 bg-white/95 p-4 shadow-2xl shadow-slate-950/25 backdrop-blur"
        style={dragPosition ? { transform: `translate3d(${dragPosition.x}px, ${dragPosition.y}px, 0)` } : undefined}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div
            className={`min-w-0 flex-1 select-none rounded-lg pr-3 ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            onPointerDown={startDrag}
            title="Перетащить мастер"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-500">
              {state.mode === "create" ? "Мастер создания" : "Мастер настройки"}
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">
              {state.mode === "create" ? "+ Эшелон" : "Размеры эшелона"}
            </h3>
            <p className="mt-1 hidden text-[11px] font-medium text-slate-400 sm:block">Потяните за заголовок, чтобы переместить окно</p>
          </div>
          <button
            type="button"
            className="h-8 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            onClick={onCancel}
          >
            Отмена
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {state.mode === "create" ? (
              <label className="sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Позиция</span>
                <select
                  className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                  value={state.insertPosition}
                  onChange={(event) => onSelectInsertPosition(event.target.value)}
                >
                  {insertOptions.map((option) => (
                    <option key={layerInsertOptionKey(option)} value={layerInsertOptionKey(option)}>
                      {option.label} · {formatWizardRange(option)}
                      {option.availableWidthM <= 0 ? " · нет свободного gap" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Код</span>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                value={state.draft.code}
                onChange={(event) => onDraftChange({ code: event.target.value })}
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Название</span>
              <input
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                value={state.draft.name}
                onChange={(event) => onDraftChange({ name: event.target.value })}
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Внутренний радиус, км</span>
              <input
                type="number"
                min={0}
                step={0.1}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                value={metersToKilometers(state.draft.innerRadiusM)}
                onChange={(event) => onDraftChange({ innerRadiusM: kilometersToMeters(event.target.value) })}
              />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Ширина, км</span>
              <input
                type="number"
                min={0}
                step={0.1}
                className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                value={metersToKilometers(state.draft.widthM)}
                onChange={(event) => onDraftChange({ widthM: kilometersToMeters(event.target.value) })}
              />
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Preview диапазона</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatDistance(state.draft.innerRadiusM)}-{formatDistance(outerRadiusM)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              outerRadiusM вычисляется автоматически: {outerRadiusM.toLocaleString("ru-RU")} м
            </p>
            {validationMessage ? (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                {validationMessage}
              </div>
            ) : null}
            {state.mode === "edit" && conflictCount > 0 && isValid ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                После сохранения {conflictCount} объект(ов) окажутся вне кольца. Сохранение разрешено.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Пересечения запрещены, касание границ допустимо. Соседние эшелоны не сдвигаются.
          </p>
          <button
            type="button"
            className="h-10 cursor-pointer rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white shadow-md shadow-sky-600/20 hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            disabled={!isValid}
            onClick={onSubmit}
          >
            {state.mode === "create" ? "Создать" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
