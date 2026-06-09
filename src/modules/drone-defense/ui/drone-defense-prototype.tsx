"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppstoreOutlined, CloseOutlined, DownOutlined, UpOutlined } from "@ant-design/icons";
import { useDefenseStudioStore, studioPreviewData } from "@/modules/drone-defense/domain/use-defense-studio-store";
import { buildEchelonMapModel } from "@/modules/drone-defense/domain/echelon-map-model";
import { placedObjectsToMapPlacements } from "@/modules/drone-defense/domain/project-map-adapter";
import { CoordinatePlacementPanel, type CoordinatePlacementInput } from "@/modules/drone-defense/ui/coordinate-placement-panel";
import { DefenseToolsPanel } from "@/modules/drone-defense/ui/defense-tools-panel";
import { FacilityDrilldown } from "@/modules/drone-defense/ui/facility-drilldown";
import { GisBoard } from "@/modules/drone-defense/ui/gis-board";
import { EchelonObjectsList } from "@/modules/drone-defense/ui/echelon-objects-list";
import {
  type AssetCatalogItem,
  calculateLayerSummaries,
  findLayerInsertOptions,
  getAssetCatalogItems,
  getLayerRadii,
  validateLayerGeometry,
} from "@/shared/lib/defense-project";
import { MAX_DEFENSE_PROJECT_LAYERS, useDefenseProjectStore } from "@/shared/lib/use-defense-project-store";
import type { Coordinates, DefenseProject, EditableDefenseLayer, PlacementValidationResult } from "@/shared/types/defense-project";
import type { LayerInsertOption } from "@/shared/lib/defense-project";
import type { DefenseLayer, DefenseLayerId } from "@/shared/types/drone-defense";
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

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

type CoordinatePlacementValidationState = Pick<PlacementValidationResult, "level" | "message">;

const defenseAssetDragMimeType = "application/x-fortis-defense-asset";

function formatWizardRange(option: LayerInsertOption) {
  const max = option.maxOuterRadiusM === null ? "∞" : formatDistance(option.maxOuterRadiusM);
  return `${formatDistance(option.minInnerRadiusM)}-${max}`;
}

function layerInsertOptionKey(option: LayerInsertOption) {
  if (option.kind === "between") return `between:${option.beforeLayerId}:${option.afterLayerId}`;
  return option.kind;
}

function parseCoordinatePlacementInput(
  input: CoordinatePlacementInput,
): { ok: true; coordinates: Coordinates; notes?: string } | { ok: false; message: string } {
  const parseNumeric = (value: string) => Number(value.trim().replace(",", "."));
  const lat = parseNumeric(input.lat);
  const lng = parseNumeric(input.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, message: "Введите широту и долготу числом." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, message: "Широта должна быть в диапазоне от -90 до 90." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, message: "Долгота должна быть в диапазоне от -180 до 180." };
  }

  const altitudeValue = input.altitude.trim();
  const altitude = altitudeValue ? parseNumeric(altitudeValue) : null;
  if (altitude !== null && (!Number.isFinite(altitude) || altitude < 0)) {
    return { ok: false, message: "Высота должна быть положительным числом." };
  }

  return {
    ok: true,
    coordinates: altitude === null ? { lat, lng } : { lat, lng, altitude },
    notes: input.notes.trim() || undefined,
  };
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
  const [isCatalogTrayOpen, setIsCatalogTrayOpen] = useState(true);
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
  const [isLayerPanelExpanded, setIsLayerPanelExpanded] = useState(true);
  const [layerPanelMode, setLayerPanelMode] = useState<"view" | "edit">("view");
  const [layerWizardState, setLayerWizardState] = useState<LayerWizardState | null>(null);
  const [coordinatePlacementAssetId, setCoordinatePlacementAssetId] = useState<string | null>(null);
  const [coordinatePlacementValidation, setCoordinatePlacementValidation] = useState<CoordinatePlacementValidationState | null>(null);
  const [pointerDraggedAssetId, setPointerDraggedAssetId] = useState<string | null>(null);
  const [lastPlacementMessage, setLastPlacementMessage] = useState<string | null>(null);
  const [locateTarget, setLocateTarget] = useState<{ lon: number; lat: number; at: number } | null>(null);
  const [echelonObjectsLayerId, setEchelonObjectsLayerId] = useState<DefenseLayerId | null>(null);
  const [isEchelonObjectsCollapsed, setIsEchelonObjectsCollapsed] = useState(false);
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
    selectedPlacementId,
    coverageVisible,
    selectPlacement,
    setCoverageVisible,
    placeAssetInSlot,
    removePlacement,
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
    deletePlacedObject,
    validateObjectPlacement,
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
  const assetCatalogItems = useMemo(
    () => getAssetCatalogItems(project, selectedLayer?.code, project.placedObjects),
    [project, selectedLayer?.code],
  );
  const filteredCatalogItems = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    return assetCatalogItems.filter((item) => {
      if (!query) return true;
      const haystack = [
        item.title,
        item.subtitle,
        item.categoryLabel,
        item.rangeLabel,
        item.priceLabel,
        item.coverageLabel,
        item.category,
        ...item.roles,
        ...item.tags,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [assetCatalogItems, catalogQuery]);
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
  const selectedLayerObjects = useMemo(
    () => project.placedObjects.filter((object) => object.layerId === selectedLayerId),
    [project.placedObjects, selectedLayerId],
  );
  const activeEchelonObjectsLayer = useMemo(
    () => project.layers.find((layer) => layer.id === echelonObjectsLayerId) ?? selectedLayer,
    [echelonObjectsLayerId, project.layers, selectedLayer],
  );
  const selectedPlacedObject = useMemo(
    () => project.placedObjects.find((object) => object.id === selectedObjectId) ?? null,
    [project.placedObjects, selectedObjectId],
  );
  const coordinatePlacementAsset = useMemo(
    () => project.assetLibrary.find((asset) => asset.id === coordinatePlacementAssetId) ?? null,
    [project.assetLibrary, coordinatePlacementAssetId],
  );
  const canCreateLayer = project.layers.length < MAX_DEFENSE_PROJECT_LAYERS;
  const canDeleteSelectedLayer = project.layers.length > 1 && selectedLayerObjects.length === 0;
  const isLayerEditMode = layerPanelMode === "edit";
  const showCompactLayerPanel = !isLayerPanelExpanded;

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

  const handleLocatePlacement = (placement: { id: string; mapRef?: { lon: number; lat: number } }) => {
    selectPlacement(placement.id);
    if (placement.mapRef) {
      setLocateTarget({ lon: placement.mapRef.lon, lat: placement.mapRef.lat, at: Date.now() });
    }
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
    setLastPlacementMessage("Размеры эшелона сохранены");
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
    setCoordinatePlacementAssetId(null);
    setCoordinatePlacementValidation(null);
    setLastPlacementMessage(
      nextId
        ? `${selectedLayer?.code ?? "—"} · ${asset.title}: кликните по карте внутри активного эшелона`
        : null,
    );
  };

  const openCoordinatePlacement = (asset: AssetCatalogItem) => {
    if (!selectedLayer) {
      setLastPlacementMessage("Выберите эшелон для размещения.");
      return;
    }
    setActiveToolId(asset.assetId);
    selectAsset(asset.assetId);
    setCoordinatePlacementAssetId(asset.assetId);
    setCoordinatePlacementValidation(null);
    setIsCatalogTrayOpen(true);
    setLastPlacementMessage(`${selectedLayer.code} · ${asset.title}: введите координаты точки`);
  };

  const placeActiveToolAtCoordinate = ({ lng, lat }: { lng: number; lat: number }) => {
    if (!activeToolId || !selectedLayer) return;
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

  const placeDraggedAssetAtCoordinate = (assetId: string, { lng, lat }: { lng: number; lat: number }) => {
    if (!selectedLayer) return;
    const asset = project.assetLibrary.find((item) => item.id === assetId);
    if (!asset) {
      setLastPlacementMessage("Средство защиты не найдено в библиотеке");
      setPointerDraggedAssetId(null);
      return;
    }
    setActiveToolId(asset.id);
    selectAsset(asset.id);
    const validation = placeObject(asset.id, selectedLayer.id, { lat, lng });
    setPointerDraggedAssetId(null);
    setLastPlacementMessage(
      validation.message ??
        (validation.isValid
          ? `${asset.name} размещено в эшелоне ${selectedLayer.code}`
          : "Не удалось разместить объект"),
    );
  };

  const startAssetDrag = (asset: AssetCatalogItem, event: ReactDragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(defenseAssetDragMimeType, asset.assetId);
    event.dataTransfer.setData("application/x-fortis-group", asset.assetId);
    event.dataTransfer.setData("text/plain", asset.title);
    setPointerDraggedAssetId(asset.assetId);
    setActiveToolId(asset.assetId);
    selectAsset(asset.assetId);
    setCoordinatePlacementAssetId(null);
    setCoordinatePlacementValidation(null);
    setLastPlacementMessage(`${asset.title}: перетащите карточку на карту`);
  };

  const startAssetPointerDrag = (asset: AssetCatalogItem, event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setPointerDraggedAssetId(asset.assetId);
    setActiveToolId(asset.assetId);
    selectAsset(asset.assetId);
    setCoordinatePlacementAssetId(null);
    setCoordinatePlacementValidation(null);
    setLastPlacementMessage(`${asset.title}: перетащите карточку на карту`);
  };

  const startAssetMouseDrag = (asset: AssetCatalogItem, event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    setPointerDraggedAssetId(asset.assetId);
    setActiveToolId(asset.assetId);
    selectAsset(asset.assetId);
    setCoordinatePlacementAssetId(null);
    setCoordinatePlacementValidation(null);
    setLastPlacementMessage(`${asset.title}: перетащите карточку на карту`);
  };

  useEffect(() => {
    if (!pointerDraggedAssetId) return;
    const clearPointerDrag = () => setPointerDraggedAssetId(null);
    window.addEventListener("pointerup", clearPointerDrag);
    window.addEventListener("pointercancel", clearPointerDrag);
    window.addEventListener("mouseup", clearPointerDrag);
    window.addEventListener("dragend", clearPointerDrag);
    return () => {
      window.removeEventListener("pointerup", clearPointerDrag);
      window.removeEventListener("pointercancel", clearPointerDrag);
      window.removeEventListener("mouseup", clearPointerDrag);
      window.removeEventListener("dragend", clearPointerDrag);
    };
  }, [pointerDraggedAssetId]);

  const checkCoordinatePlacement = (input: CoordinatePlacementInput) => {
    if (!coordinatePlacementAsset || !selectedLayer) {
      setCoordinatePlacementValidation({ level: "error", message: "Выберите средство и эшелон." });
      return;
    }
    const parsed = parseCoordinatePlacementInput(input);
    if (!parsed.ok) {
      setCoordinatePlacementValidation({ level: "error", message: parsed.message });
      setLastPlacementMessage(parsed.message);
      return;
    }
    const validation = validateObjectPlacement(coordinatePlacementAsset.id, selectedLayer.id, parsed.coordinates);
    const message = validation.message ?? (validation.isValid ? "Точка допустима для размещения." : "Точка недопустима.");
    setCoordinatePlacementValidation({ level: validation.level, message });
    setLastPlacementMessage(message);
  };

  const placeCoordinateObject = (input: CoordinatePlacementInput) => {
    if (!coordinatePlacementAsset || !selectedLayer) {
      setCoordinatePlacementValidation({ level: "error", message: "Выберите средство и эшелон." });
      return;
    }
    const parsed = parseCoordinatePlacementInput(input);
    if (!parsed.ok) {
      setCoordinatePlacementValidation({ level: "error", message: parsed.message });
      setLastPlacementMessage(parsed.message);
      return;
    }
    const validation = placeObject(coordinatePlacementAsset.id, selectedLayer.id, parsed.coordinates, { notes: parsed.notes });
    if (!validation.isValid) {
      const message = validation.message ?? "Точка недопустима для размещения.";
      setCoordinatePlacementValidation({ level: validation.level, message });
      setLastPlacementMessage(message);
      return;
    }
    setActiveToolId(coordinatePlacementAsset.id);
    setCoordinatePlacementAssetId(null);
    setCoordinatePlacementValidation(null);
    setLastPlacementMessage(
      validation.message ?? `${coordinatePlacementAsset.name} размещено в эшелоне ${selectedLayer.code}`,
    );
  };

  const removeCatalogAsset = (assetId: string) => {
    const asset = project.assetLibrary.find((item) => item.id === assetId);
    if (!selectedPlacedObject || selectedPlacedObject.assetId !== assetId) {
      setLastPlacementMessage(`${asset?.name ?? "Средство защиты"}: выберите размещённый объект для удаления`);
      return;
    }
    deletePlacedObject(selectedPlacedObject.id);
    setLastPlacementMessage(`${asset?.name ?? "Средство защиты"} удалено из общей конфигурации`);
  };

  const selectLayerWithDefaultSlot = (layerId: string) => {
    selectLayer(layerId);
    setActiveToolId(null);
    setCoordinatePlacementAssetId(null);
    setCoordinatePlacementValidation(null);
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
      setCoordinatePlacementAssetId(null);
      setCoordinatePlacementValidation(null);
      setLastPlacementMessage(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      {isCatalogTrayOpen ? (
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

          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="border-b border-slate-100 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Библиотека СЗ</p>
                  <h2 className="truncate text-sm font-semibold text-slate-950">
                    {selectedLayer?.code ?? "—"} · {selectedLayer?.name ?? "Эшелон не выбран"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {formatDistance(selectedRadii.innerRadiusM)}-{formatDistance(selectedRadii.outerRadiusM)}
                  </p>
                </div>
                <button
                  type="button"
                  className="h-8 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  onClick={() => setIsCatalogTrayOpen(false)}
                  title="Свернуть библиотеку в угол карты"
                >
                  Свернуть
                </button>
              </div>
              <input
                className="mt-3 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Найти средство..."
              />
            </div>
            <div className="h-full overflow-y-auto p-3 pb-28">
              <DefenseToolsPanel
                assets={filteredCatalogItems}
                projectAssets={project.assetLibrary}
                selectedToolId={activeToolId}
                selectedObjectAssetId={selectedPlacedObject?.assetId}
                onSelectTool={handleSelectTool}
                onOpenCoordinates={openCoordinatePlacement}
                onDragAsset={startAssetDrag}
                onPointerDragAsset={startAssetPointerDrag}
                onMouseDragAsset={startAssetMouseDrag}
                onRemoveTool={(asset) => removeCatalogAsset(asset.assetId)}
              />
            </div>
          </div>
        </section>
      ) : null}

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

        {echelonObjectsLayerId && activeEchelonObjectsLayer ? (
          <aside className="absolute right-4 top-4 z-30 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">Объекты эшелона</p>
                <h3 className="text-sm font-semibold text-slate-950">{activeEchelonObjectsLayer.code} · {activeEchelonObjectsLayer.name}</h3>
                <p className="text-xs text-slate-500">Открывается отдельно, чтобы не перегружать основную панель.</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => setIsEchelonObjectsCollapsed((current) => !current)}
                  title={isEchelonObjectsCollapsed ? "Развернуть карточку" : "Свернуть карточку"}
                >
                  {isEchelonObjectsCollapsed ? <UpOutlined /> : <DownOutlined />}
                </button>
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                  onClick={() => setEchelonObjectsLayerId(null)}
                  title="Закрыть карточку"
                  aria-label="Закрыть карточку"
                >
                  <CloseOutlined />
                </button>
              </div>
            </div>
            {!isEchelonObjectsCollapsed ? (
              <div className="max-h-[70vh] overflow-y-auto p-4">
                <label className="mb-3 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span>Покрытие</span>
                  <input
                    type="checkbox"
                    checked={coverageVisible}
                    onChange={(event) => setCoverageVisible(event.target.checked)}
                  />
                </label>
                <EchelonObjectsList
                  layerId={echelonObjectsLayerId}
                  placements={mapConfiguration.placements}
                  catalog={catalog}
                  selectedPlacementId={selectedPlacementId}
                  onSelect={(id) => selectPlacement(id)}
                  onLocate={handleLocatePlacement}
                  onRemove={(id) => void removePlacement(id)}
                />
              </div>
            ) : null}
          </aside>
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
              selectedPlacementId={selectedPlacementId}
              coverageVisible={coverageVisible}
              locateTarget={locateTarget}
              onSelectPlacement={(id) => selectPlacement(id)}
              onDropAsset={(args) => void placeAssetInSlot(args)}
            />

            {coordinatePlacementAsset && selectedLayer ? (
              <CoordinatePlacementPanel
                assetName={coordinatePlacementAsset.name}
                layerLabel={`${selectedLayer.code} · ${selectedLayer.name}`}
                validationMessage={coordinatePlacementValidation?.message}
                validationLevel={coordinatePlacementValidation?.level}
                onCheck={checkCoordinatePlacement}
                onPlace={placeCoordinateObject}
                onCancel={() => {
                  setCoordinatePlacementAssetId(null);
                  setCoordinatePlacementValidation(null);
                }}
              />
            ) : null}

            {selectedLayer ? (
              <div
                className={`pointer-events-none absolute inset-x-3 bottom-3 z-20 flex lg:inset-x-5 ${
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
                            onClick={() => {
                              selectLayerWithDefaultSlot(layer.id);
                              setEchelonObjectsLayerId(layer.id as DefenseLayerId);
                            }}
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
                            {isSelected && isLayerEditMode ? (
                              <span className="ml-auto flex items-center gap-1">
                                <button
                                  type="button"
                                  className="cursor-pointer rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-200"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    editSelectedLayer();
                                  }}
                                >
                                  Настроить
                                </button>
                                <button
                                  type="button"
                                  className="cursor-pointer rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    deleteSelectedLayer();
                                  }}
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

                    </>
                  )}
                </div>
              </div>
            ) : null}

            {!isCatalogTrayOpen ? (
              <button
                type="button"
                className="absolute left-4 top-20 z-40 grid h-12 w-12 cursor-pointer place-items-center rounded-xl bg-blue-600 text-lg text-white shadow-xl shadow-blue-950/25 transition hover:bg-blue-700"
                onClick={() => setIsCatalogTrayOpen(true)}
                title="Открыть библиотеку средств защиты"
                aria-label="Открыть библиотеку средств защиты"
              >
                <AppstoreOutlined />
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
