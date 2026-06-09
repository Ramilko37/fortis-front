"use client";

import { create } from "zustand";
import {
  createDefaultDefenseProject,
  createRingLayer,
  applyAssetQuantityDraftsToProject,
  canEditLayer,
  deleteLayerFromProject,
  deletePlacedObjectInProject,
  duplicatePlacedObjectInProject,
  exportDefenseProjectJson,
  importDefenseProjectJson,
  legacySelectedConfigurationToProject,
  movePlacedObjectInProject,
  placeObjectInProject,
  recenterProject,
  setAssetQuantityInProject,
  syncPlacedObjectConflictFlags,
  transferPlacedObjectToLayerInProject,
  updateLayerGeometryFromRadii,
  updateLayerOrder,
  updatePlacedObjectInProject,
  validateLayerGeometry,
  validateObjectPlacement,
} from "@/shared/lib/defense-project";
import { loadPresetIntoConfiguration } from "@/shared/lib/defense-configuration";
import { FORTIS_CONFIGURATION_STORAGE_KEY } from "@/shared/lib/use-defense-configuration-store";
import type {
  Coordinates,
  DefenseProject,
  DeleteLayerResult,
  EditableDefenseLayer,
  PlacedDefenseObject,
  PlacementValidationResult,
} from "@/shared/types/defense-project";
import type { LayerGeometryValidationResult } from "@/shared/lib/defense-project";

export const FORTIS_DEFENSE_PROJECT_STORAGE_KEY = "fortis-defense-project";
export const MAX_DEFENSE_PROJECT_LAYERS = 20;

type DefenseProjectState = {
  project: DefenseProject;
  hydrated: boolean;
  budgetApplied: boolean;
  activeLayerId?: string;
  selectedAssetId?: string;
  selectedObjectId?: string;
  createLayer: (data: Partial<EditableDefenseLayer>) => void;
  createLayerFromDraft: (
    draft: Partial<EditableDefenseLayer> & { innerRadiusM: number; widthM: number },
  ) => { ok: true; layer: EditableDefenseLayer } | { ok: false; validation: LayerGeometryValidationResult };
  updateLayer: (layerId: string, patch: Partial<EditableDefenseLayer>) => void;
  updateLayerGeometry: (
    layerId: string,
    radii: { innerRadiusM: number; widthM: number },
  ) => { ok: true; layer: EditableDefenseLayer } | { ok: false; validation: LayerGeometryValidationResult };
  deleteLayer: (layerId: string) => DeleteLayerResult;
  moveLayerUp: (layerId: string) => void;
  moveLayerDown: (layerId: string) => void;
  setLayerVisibility: (layerId: string, isVisible: boolean) => void;
  setLayerLocked: (layerId: string, isLocked: boolean) => void;
  selectLayer: (layerId: string) => void;
  setBaseObjectCenter: (center: Coordinates) => void;
  selectAsset: (assetId: string) => void;
  selectObject: (objectId: string) => void;
  setAssetQuantity: (assetId: string, quantity: number) => void;
  placeObject: (
    assetId: string,
    layerId: string,
    coordinates: Coordinates,
    patch?: Partial<PlacedDefenseObject>,
  ) => PlacementValidationResult;
  moveObject: (objectId: string, coordinates: Coordinates) => PlacementValidationResult;
  transferObjectToLayer: (objectId: string, layerId: string) => PlacementValidationResult;
  updatePlacedObject: (objectId: string, patch: Partial<PlacedDefenseObject>) => void;
  deletePlacedObject: (objectId: string) => void;
  duplicatePlacedObject: (objectId: string) => void;
  validateObjectPlacement: (assetId: string, layerId: string, coordinates: Coordinates) => PlacementValidationResult;
  loadPresetProject: (presetId: string) => void;
  applyBudgetSelection: (picks: Array<{ assetId: string; included: boolean }>) => void;
  clearProject: () => void;
  saveProjectToLocalStorage: () => void;
  restoreProjectFromLocalStorage: () => void;
  exportProjectJson: () => string;
  importProjectJson: (raw: string) => void;
};

function canUseLocalStorage() {
  return typeof globalThis.localStorage !== "undefined";
}

function persist(project: DefenseProject) {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(FORTIS_DEFENSE_PROJECT_STORAGE_KEY, exportDefenseProjectJson(project));
}

function readProject(): DefenseProject | null {
  if (!canUseLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(FORTIS_DEFENSE_PROJECT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return importDefenseProjectJson(raw);
  } catch {
    return null;
  }
}

function readLegacyConfigurationProject(): DefenseProject | null {
  if (!canUseLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(FORTIS_CONFIGURATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.selectedItems) return null;
    return legacySelectedConfigurationToProject(parsed);
  } catch {
    return null;
  }
}

function syncSelection(project: DefenseProject) {
  return {
    activeLayerId: project.activeLayerId,
    selectedAssetId: project.selectedAssetId,
    selectedObjectId: project.selectedObjectId,
  };
}

function applyProject(project: DefenseProject, set: (state: Partial<DefenseProjectState>) => void) {
  persist(project);
  set({ project, budgetApplied: false, ...syncSelection(project) });
}

export const useDefenseProjectStore = create<DefenseProjectState>((set, get) => {
  const initialProject = createDefaultDefenseProject();
  return {
    project: initialProject,
    hydrated: false,
    budgetApplied: false,
    ...syncSelection(initialProject),
    createLayer: (data) => {
      if (get().project.layers.length >= MAX_DEFENSE_PROJECT_LAYERS) return;
      const layer = createRingLayer(get().project, { ...data, isActive: true });
      const project = {
        ...get().project,
        layers: [
          ...get().project.layers.map((item) => ({ ...item, isActive: false })),
          layer,
        ],
        activeLayerId: layer.id,
        updatedAt: new Date().toISOString(),
      };
      applyProject(project, set);
    },
    createLayerFromDraft: (draft) => {
      if (get().project.layers.length >= MAX_DEFENSE_PROJECT_LAYERS) {
        return {
          ok: false,
          validation: {
            isValid: false,
            level: "error",
            message: `Достигнут максимум: ${MAX_DEFENSE_PROJECT_LAYERS} эшелонов.`,
          },
        };
      }
      const layer = createRingLayer(get().project, { ...draft, isActive: true });
      const validation = validateLayerGeometry(get().project, layer);
      if (!validation.isValid) return { ok: false, validation };
      const project = {
        ...get().project,
        layers: [
          ...get().project.layers.map((item) => ({ ...item, isActive: false })),
          layer,
        ].map((item, index) => ({ ...item, order: index + 1 })),
        activeLayerId: layer.id,
        updatedAt: new Date().toISOString(),
      };
      applyProject(project, set);
      return { ok: true, layer };
    },
    updateLayer: (layerId, patch) => {
      if (!canEditLayer(get().project, layerId)) return;
      const project = syncPlacedObjectConflictFlags({
        ...get().project,
        layers: get().project.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
        updatedAt: new Date().toISOString(),
      });
      applyProject(project, set);
    },
    updateLayerGeometry: (layerId, radii) => {
      if (!canEditLayer(get().project, layerId)) {
        return {
          ok: false,
          validation: {
            isValid: false,
            level: "error",
            message: "Эшелон заблокирован. Сначала снимите блокировку.",
          },
        };
      }
      const layer = get().project.layers.find((item) => item.id === layerId);
      if (!layer) {
        return {
          ok: false,
          validation: {
            isValid: false,
            level: "error",
            message: "Эшелон не найден.",
          },
        };
      }
      const updatedLayer = updateLayerGeometryFromRadii(layer, radii);
      const validation = validateLayerGeometry(get().project, updatedLayer, layerId);
      if (!validation.isValid) return { ok: false, validation };
      const project = syncPlacedObjectConflictFlags({
        ...get().project,
        layers: get().project.layers.map((item) => (item.id === layerId ? updatedLayer : item)),
        updatedAt: new Date().toISOString(),
      });
      applyProject(project, set);
      return { ok: true, layer: updatedLayer };
    },
    deleteLayer: (layerId) => {
      const result = deleteLayerFromProject(get().project, layerId);
      if (result.ok) applyProject(result.project, set);
      return result;
    },
    moveLayerUp: (layerId) => applyProject(updateLayerOrder(get().project, layerId, "up"), set),
    moveLayerDown: (layerId) => applyProject(updateLayerOrder(get().project, layerId, "down"), set),
    setLayerVisibility: (layerId, isVisible) => {
      const project = {
        ...get().project,
        layers: get().project.layers.map((layer) => (layer.id === layerId ? { ...layer, isVisible } : layer)),
        updatedAt: new Date().toISOString(),
      };
      applyProject(project, set);
    },
    setLayerLocked: (layerId, isLocked) => {
      const project = {
        ...get().project,
        layers: get().project.layers.map((layer) => (layer.id === layerId ? { ...layer, isLocked } : layer)),
        updatedAt: new Date().toISOString(),
      };
      applyProject(project, set);
    },
    selectLayer: (layerId) => {
      const project = {
        ...get().project,
        activeLayerId: layerId,
        layers: get().project.layers.map((layer) => ({ ...layer, isActive: layer.id === layerId })),
      };
      persist(project);
      set({ project, ...syncSelection(project) });
    },
    setBaseObjectCenter: (center) => {
      const current = get().project.baseObject.center;
      if (current.lat === center.lat && current.lng === center.lng) return;
      applyProject(recenterProject(get().project, center), set);
    },
    selectAsset: (assetId) => {
      const project = { ...get().project, selectedAssetId: assetId, mode: "place-object" as const };
      persist(project);
      set({ project, ...syncSelection(project) });
    },
    selectObject: (objectId) => {
      const object = get().project.placedObjects.find((item) => item.id === objectId);
      if (!object) return;
      const project = {
        ...get().project,
        selectedObjectId: objectId,
        activeLayerId: object.layerId,
        layers: get().project.layers.map((layer) => ({ ...layer, isActive: layer.id === object.layerId })),
      };
      persist(project);
      set({ project, ...syncSelection(project) });
    },
    setAssetQuantity: (assetId, quantity) => applyProject(setAssetQuantityInProject(get().project, assetId, quantity), set),
    placeObject: (assetId, layerId, coordinates, patch) => {
      const validation = validateObjectPlacement(get().project, assetId, layerId, coordinates);
      if (!validation.isValid) return validation;
      const project = placeObjectInProject(get().project, assetId, layerId, coordinates, patch);
      applyProject(project, set);
      return validation;
    },
    moveObject: (objectId, coordinates) => {
      const object = get().project.placedObjects.find((item) => item.id === objectId);
      const validation = object
        ? validateObjectPlacement(get().project, object.assetId, object.layerId, coordinates)
        : { isValid: false, level: "error" as const, message: "Объект не найден" };
      if (!validation.isValid) return validation;
      applyProject(movePlacedObjectInProject(get().project, objectId, coordinates), set);
      return validation;
    },
    transferObjectToLayer: (objectId, layerId) => {
      const result = transferPlacedObjectToLayerInProject(get().project, objectId, layerId);
      if (result.validation.isValid) applyProject(result.project, set);
      return result.validation;
    },
    updatePlacedObject: (objectId, patch) => applyProject(updatePlacedObjectInProject(get().project, objectId, patch), set),
    deletePlacedObject: (objectId) => applyProject(deletePlacedObjectInProject(get().project, objectId), set),
    duplicatePlacedObject: (objectId) => applyProject(duplicatePlacedObjectInProject(get().project, objectId), set),
    validateObjectPlacement: (assetId, layerId, coordinates) => validateObjectPlacement(get().project, assetId, layerId, coordinates),
    loadPresetProject: (presetId) => {
      const legacy = loadPresetIntoConfiguration(presetId);
      const project = {
        ...legacySelectedConfigurationToProject(legacy),
        source: "preset" as const,
        basePresetId: presetId,
      };
      applyProject(project, set);
    },
    applyBudgetSelection: (picks) => {
      const lines = picks
        .filter((pick) => pick.included)
        .map((pick) => ({ assetId: pick.assetId, quantity: 1 }));
      applyProject({ ...applyAssetQuantityDraftsToProject(get().project, lines), source: "custom" }, set);
      set({ budgetApplied: true });
    },
    clearProject: () => {
      const project = createDefaultDefenseProject();
      persist(project);
      set({ project, hydrated: true, budgetApplied: false, ...syncSelection(project) });
    },
    saveProjectToLocalStorage: () => persist(get().project),
    restoreProjectFromLocalStorage: () => {
      const project = readProject() ?? readLegacyConfigurationProject() ?? createDefaultDefenseProject();
      set({ project, hydrated: true, budgetApplied: false, ...syncSelection(project) });
    },
    exportProjectJson: () => exportDefenseProjectJson(get().project),
    importProjectJson: (raw) => {
      const project = importDefenseProjectJson(raw);
      applyProject(project, set);
    },
  };
});
