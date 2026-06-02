"use client";

import { create } from "zustand";
import {
  addDefenseItemToConfiguration,
  applyBudgetPicksToConfiguration,
  createEmptyConfiguration,
  loadPresetIntoConfiguration,
  removeDefenseItemFromConfiguration,
  setDefenseItemQuantityInConfiguration,
} from "@/shared/lib/defense-configuration";
import type { SelectedConfiguration } from "@/shared/types/defense-configuration";

export const FORTIS_CONFIGURATION_STORAGE_KEY = "fortis-current-configuration";

type BudgetPickInput = {
  assetId: string;
  included: boolean;
};

type DefenseConfigurationState = {
  configuration: SelectedConfiguration;
  hydrated: boolean;
  addDefenseItem: (itemId: string) => void;
  removeDefenseItem: (itemId: string) => void;
  setDefenseItemQuantity: (itemId: string, quantity: number) => void;
  clearConfiguration: () => void;
  loadPresetConfiguration: (presetId: string) => void;
  applyBudgetSelection: (picks: BudgetPickInput[]) => void;
  saveConfigurationToLocalStorage: () => void;
  restoreConfigurationFromLocalStorage: () => void;
};

function canUseLocalStorage() {
  return typeof globalThis.localStorage !== "undefined";
}

function persist(configuration: SelectedConfiguration) {
  if (!canUseLocalStorage()) return;
  globalThis.localStorage.setItem(FORTIS_CONFIGURATION_STORAGE_KEY, JSON.stringify(configuration));
}

function readPersistedConfiguration(): SelectedConfiguration | null {
  if (!canUseLocalStorage()) return null;
  const raw = globalThis.localStorage.getItem(FORTIS_CONFIGURATION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SelectedConfiguration;
    if (!parsed?.selectedItems || parsed.id !== "current") return null;
    return parsed;
  } catch {
    return null;
  }
}

export const useDefenseConfigurationStore = create<DefenseConfigurationState>((set, get) => ({
  configuration: createEmptyConfiguration(),
  hydrated: false,
  addDefenseItem: (itemId) => {
    const configuration = addDefenseItemToConfiguration(get().configuration, itemId);
    persist(configuration);
    set({ configuration });
  },
  removeDefenseItem: (itemId) => {
    const configuration = removeDefenseItemFromConfiguration(get().configuration, itemId);
    persist(configuration);
    set({ configuration });
  },
  setDefenseItemQuantity: (itemId, quantity) => {
    const configuration = setDefenseItemQuantityInConfiguration(get().configuration, itemId, quantity);
    persist(configuration);
    set({ configuration });
  },
  clearConfiguration: () => {
    const configuration = createEmptyConfiguration();
    persist(configuration);
    set({ configuration, hydrated: true });
  },
  loadPresetConfiguration: (presetId) => {
    const configuration = loadPresetIntoConfiguration(presetId);
    persist(configuration);
    set({ configuration, hydrated: true });
  },
  applyBudgetSelection: (picks) => {
    const configuration = applyBudgetPicksToConfiguration(get().configuration, picks);
    persist(configuration);
    set({ configuration, hydrated: true });
  },
  saveConfigurationToLocalStorage: () => persist(get().configuration),
  restoreConfigurationFromLocalStorage: () => {
    const configuration = readPersistedConfiguration() ?? createEmptyConfiguration();
    set({ configuration, hydrated: true });
  },
}));
