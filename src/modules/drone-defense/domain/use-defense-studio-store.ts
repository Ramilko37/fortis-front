"use client";

import { create } from "zustand";
import { buildScenarioConfiguration, hexCells, threatRoutes } from "@/modules/drone-defense/infra/mock-defense-data";
import {
  evaluateConfigurationRequest,
  fetchCatalog,
  fetchFacilities,
  fetchLayers,
  recommendConfigurationRequest,
} from "@/modules/drone-defense/infra/api-client";
import type { RecommendRequest } from "@/shared/types/drone-defense";
import {
  recommendDefense as localRecommendDefense,
  evaluateDefense as localEvaluateDefense,
  getCatalog as localGetCatalog,
  getFacilities as localGetFacilities,
  getLayers as localGetLayers,
} from "@/modules/drone-defense/infra/mock-defense-repository";
import type {
  Configuration,
  DefenseCatalogResponse,
  DefenseLayersResponse,
  DefenseScenarioId,
  Facility,
  KpiResult,
  Placement,
  Recommendation,
} from "@/shared/types/drone-defense";

type StudioView = "gis" | "comparison" | "drilldown";

type StudioState = {
  view: StudioView;
  facilityId: string;
  scenarioId: DefenseScenarioId;
  configuration: Configuration;
  budgetRub: number;
  loading: boolean;
  error: string | null;
  catalog: DefenseCatalogResponse | null;
  facilities: Facility[];
  layers: DefenseLayersResponse | null;
  layersByScenario: Partial<Record<DefenseScenarioId, DefenseLayersResponse>>;
  kpiByScenario: Partial<Record<DefenseScenarioId, KpiResult>>;
  localPlacementsByScenario: Partial<Record<DefenseScenarioId, Placement[]>>;
  recommendations: Recommendation[];
  init: () => Promise<void>;
  setView: (view: StudioView) => void;
  setContext: (args: { facilityId: string; scenarioId: DefenseScenarioId; budgetRub: number }) => Promise<void>;
  setFacilityId: (facilityId: string) => Promise<void>;
  setScenarioId: (scenarioId: DefenseScenarioId) => Promise<void>;
  setBudgetRub: (budgetRub: number) => Promise<void>;
  upsertLocalPlacement: (placement: Placement) => Promise<void>;
  moveLocalPlacement: (args: { placementId: string; x: number; z: number }) => Promise<void>;
  removeLocalPlacement: (placementId: string) => Promise<void>;
  recompute: () => Promise<void>;
};

const allScenarios: DefenseScenarioId[] = ["baseline", "balanced", "reinforced"];
const useLocalRuntime = process.env.NEXT_PUBLIC_DEFENSE_RUNTIME !== "api";

const runtime = {
  fetchCatalog: useLocalRuntime ? localGetCatalog : fetchCatalog,
  fetchFacilities: useLocalRuntime ? localGetFacilities : fetchFacilities,
  fetchLayers: useLocalRuntime
    ? (args: { facilityId: string; scenarioId: DefenseScenarioId; configuration?: Configuration }) =>
        localGetLayers(args.facilityId, args.scenarioId, args.configuration)
    : fetchLayers,
  evaluate: useLocalRuntime
    ? (configuration: ReturnType<typeof buildScenarioConfiguration>) =>
        localEvaluateDefense({ configuration, scope: "facility" })
    : (configuration: ReturnType<typeof buildScenarioConfiguration>) =>
        evaluateConfigurationRequest(configuration, "facility"),
  recommend: useLocalRuntime
    ? (configuration: ReturnType<typeof buildScenarioConfiguration>, budgetRub: number) =>
        localRecommendDefense({ configuration, budgetRub, limit: 3 } satisfies RecommendRequest)
    : recommendConfigurationRequest,
};

function buildConfiguration(
  facilityId: string,
  scenarioId: DefenseScenarioId,
  localPlacementsByScenario: Partial<Record<DefenseScenarioId, Placement[]>>,
) {
  return buildScenarioConfiguration(facilityId, scenarioId, localPlacementsByScenario[scenarioId] ?? []);
}

async function loadScenarioPack(
  facilityId: string,
  scenarioId: DefenseScenarioId,
  budgetRub: number,
  localPlacementsByScenario: Partial<Record<DefenseScenarioId, Placement[]>>,
) {
  const layerEntries = await Promise.all(
    allScenarios.map(async (item) => {
      const configuration = buildConfiguration(facilityId, item, localPlacementsByScenario);
      const layers = await runtime.fetchLayers({ facilityId, scenarioId: item, configuration });
      return [item, layers] as const;
    }),
  );

  const kpiEntries = await Promise.all(
    allScenarios.map(async (item) => {
      const configuration = buildConfiguration(facilityId, item, localPlacementsByScenario);
      const kpi = await runtime.evaluate(configuration);
      return [item, kpi] as const;
    }),
  );

  const layersByScenario = Object.fromEntries(layerEntries) as Partial<Record<DefenseScenarioId, DefenseLayersResponse>>;
  const configuration = buildConfiguration(facilityId, scenarioId, localPlacementsByScenario);
  const kpiByScenario = Object.fromEntries(kpiEntries) as Partial<Record<DefenseScenarioId, KpiResult>>;
  const recommendations = await runtime.recommend(configuration, budgetRub);

  return { configuration, layers: layersByScenario[scenarioId] ?? null, layersByScenario, kpiByScenario, recommendations };
}

export const useDefenseStudioStore = create<StudioState>((set, get) => ({
  view: "gis",
  facilityId: "facility-alpha",
  scenarioId: "baseline",
  configuration: buildScenarioConfiguration("facility-alpha", "baseline"),
  budgetRub: 55_000_000,
  loading: false,
  error: null,
  catalog: null,
  facilities: [],
  layers: null,
  layersByScenario: {},
  kpiByScenario: {},
  localPlacementsByScenario: {},
  recommendations: [],
  init: async () => {
    set({ loading: true, error: null });
    try {
      const [catalog, facilities] = await Promise.all([runtime.fetchCatalog(), runtime.fetchFacilities()]);
      const facilityId = facilities[0]?.id ?? "facility-alpha";
      const scenarioId = get().scenarioId;
      const budgetRub = get().budgetRub;
      const localPlacementsByScenario = get().localPlacementsByScenario;
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        catalog,
        facilities,
        facilityId,
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to initialize", loading: false });
    }
  },
  setView: (view) => set({ view }),
  setContext: async ({ facilityId, scenarioId, budgetRub }) => {
    set({ loading: true, facilityId, scenarioId, budgetRub, error: null });
    try {
      const localPlacementsByScenario = get().localPlacementsByScenario;
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to set context", loading: false });
    }
  },
  setFacilityId: async (facilityId) => {
    const localPlacementsByScenario: Partial<Record<DefenseScenarioId, Placement[]>> = {};
    set({ loading: true, facilityId, localPlacementsByScenario, error: null });
    try {
      const scenarioId = get().scenarioId;
      const budgetRub = get().budgetRub;
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to switch facility", loading: false });
    }
  },
  setScenarioId: async (scenarioId) => {
    set({ loading: true, scenarioId, error: null });
    try {
      const { facilityId, budgetRub } = get();
      const localPlacementsByScenario = get().localPlacementsByScenario;
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to switch scenario", loading: false });
    }
  },
  setBudgetRub: async (budgetRub) => {
    set({ loading: true, budgetRub, error: null });
    try {
      const { facilityId, scenarioId } = get();
      const localPlacementsByScenario = get().localPlacementsByScenario;
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to update budget", loading: false });
    }
  },
  upsertLocalPlacement: async (placement) => {
    const { facilityId, scenarioId, budgetRub } = get();
    const current = get().localPlacementsByScenario[scenarioId] ?? [];
    const localPlacementsByScenario = {
      ...get().localPlacementsByScenario,
      [scenarioId]: [...current.filter((item) => item.id !== placement.id), placement],
    };
    set({ loading: true, localPlacementsByScenario, error: null });
    try {
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to update local placement", loading: false });
    }
  },
  moveLocalPlacement: async ({ placementId, x, z }) => {
    const { facilityId, scenarioId, budgetRub } = get();
    const current = get().localPlacementsByScenario[scenarioId] ?? [];
    const nextPlacements = current.map((item) =>
      item.id === placementId
        ? {
            ...item,
            sceneRef: {
              x,
              z,
            },
          }
        : item,
    );
    const localPlacementsByScenario = {
      ...get().localPlacementsByScenario,
      [scenarioId]: nextPlacements,
    };
    set({ loading: true, localPlacementsByScenario, error: null });
    try {
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to move local placement", loading: false });
    }
  },
  removeLocalPlacement: async (placementId) => {
    const { facilityId, scenarioId, budgetRub } = get();
    const current = get().localPlacementsByScenario[scenarioId] ?? [];
    const localPlacementsByScenario = {
      ...get().localPlacementsByScenario,
      [scenarioId]: current.filter((item) => item.id !== placementId),
    };
    set({ loading: true, localPlacementsByScenario, error: null });
    try {
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to update budget", loading: false });
    }
  },
  recompute: async () => {
    set({ loading: true, error: null });
    try {
      const { facilityId, scenarioId, budgetRub } = get();
      const localPlacementsByScenario = get().localPlacementsByScenario;
      const pack = await loadScenarioPack(facilityId, scenarioId, budgetRub, localPlacementsByScenario);
      set({
        configuration: pack.configuration,
        layers: pack.layers,
        layersByScenario: pack.layersByScenario,
        kpiByScenario: pack.kpiByScenario,
        recommendations: pack.recommendations,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "failed to refresh", loading: false });
    }
  },
}));

export const studioPreviewData = {
  hexCells,
  threatRoutes,
};
