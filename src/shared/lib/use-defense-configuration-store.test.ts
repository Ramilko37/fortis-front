// Run: npx tsx src/shared/lib/use-defense-configuration-store.test.ts

import {
  FORTIS_CONFIGURATION_STORAGE_KEY,
  useDefenseConfigurationStore,
} from "@/shared/lib/use-defense-configuration-store";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memoryStorage.get(key) ?? null,
    setItem: (key: string, value: string) => memoryStorage.set(key, value),
    removeItem: (key: string) => memoryStorage.delete(key),
  },
  configurable: true,
});

const store = useDefenseConfigurationStore.getState();
store.clearConfiguration();
assert(Object.keys(useDefenseConfigurationStore.getState().configuration.selectedItems).length === 0, "store starts empty after clear");

store.addDefenseItem("mobile-radar");
assert(useDefenseConfigurationStore.getState().configuration.selectedItems["mobile-radar"] === 1, "add increments shared quantity");

store.removeDefenseItem("mobile-radar");
assert(!("mobile-radar" in useDefenseConfigurationStore.getState().configuration.selectedItems), "remove clears zero quantity");

store.loadPresetConfiguration("nak");
assert(useDefenseConfigurationStore.getState().configuration.source === "preset", "load preset marks source");
assert(useDefenseConfigurationStore.getState().configuration.selectedItems["mobile-radar"] === 6, "load preset writes quantities");

store.setDefenseItemQuantity("mobile-radar", 5);
assert(useDefenseConfigurationStore.getState().configuration.source === "custom", "manual edit after preset becomes custom");

const persisted = memoryStorage.get(FORTIS_CONFIGURATION_STORAGE_KEY);
assert(persisted?.includes("mobile-radar"), "changes are persisted to localStorage");

memoryStorage.set(
  FORTIS_CONFIGURATION_STORAGE_KEY,
  JSON.stringify({
    ...useDefenseConfigurationStore.getState().configuration,
    selectedItems: { "mobile-radar": 5 },
  }),
);
store.restoreConfigurationFromLocalStorage();
assert(useDefenseConfigurationStore.getState().configuration.selectedItems["mobile-radar"] === 5, "restore reads localStorage");

store.applyBudgetSelection([{ assetId: "mobile-radar", included: true }]);
assert(useDefenseConfigurationStore.getState().configuration.selectedItems["mobile-radar"] === 1, "budget apply writes selected picks");

console.log("use-defense-configuration-store.test.ts: shared store contracts passed");
