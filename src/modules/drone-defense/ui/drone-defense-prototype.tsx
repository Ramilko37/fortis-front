"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftOutlined, EnvironmentOutlined, FundProjectionScreenOutlined, RadarChartOutlined } from "@ant-design/icons";
import {
  buildCatalogPlacement,
  defenseLayers,
  getCatalogGroupsForLayer,
  scenarioOptions,
} from "@/modules/drone-defense/infra/mock-defense-data";
import { useDefenseStudioStore, studioPreviewData } from "@/modules/drone-defense/domain/use-defense-studio-store";
import { ComparisonView } from "@/modules/drone-defense/ui/comparison-view";
import { FacilityDrilldown } from "@/modules/drone-defense/ui/facility-drilldown";
import { GisBoard } from "@/modules/drone-defense/ui/gis-board";
import type { DefenseLayerId, DefenseScenarioId } from "@/shared/types/drone-defense";

type Stage = "gis" | "comparison" | "drilldown";

const stageLabels: Record<Stage, string> = {
  gis: "GIS Board",
  comparison: "Comparison",
  drilldown: "3D Drill-down",
};

export function DroneDefensePrototype() {
  const [selectedLayerId, setSelectedLayerId] = useState<DefenseLayerId>("layer_01_external_warning");
  const {
    init,
    loading,
    error,
    view,
    facilityId,
    scenarioId,
    configuration,
    budgetRub,
    catalog,
    facilities,
    layers,
    layersByScenario,
    kpiByScenario,
    recommendations,
    setView,
    setFacilityId,
    setScenarioId,
    setBudgetRub,
    upsertLocalPlacement,
    moveLocalPlacement,
    removeLocalPlacement,
  } = useDefenseStudioStore();

  useEffect(() => {
    void init();
  }, [init]);

  const selectedFacility = useMemo(
    () => facilities.find((item) => item.id === facilityId) ?? null,
    [facilities, facilityId],
  );
  const selectedLayer = useMemo(
    () => defenseLayers.find((layer) => layer.id === selectedLayerId) ?? defenseLayers[0],
    [selectedLayerId],
  );
  const selectedLayerGroups = useMemo(() => getCatalogGroupsForLayer(selectedLayerId), [selectedLayerId]);
  const selectedLayerPlacements = useMemo(
    () => configuration.placements.filter((placement) => placement.layerId === selectedLayerId),
    [configuration.placements, selectedLayerId],
  );

  const addCatalogGroup = (groupId: string) => {
    const placement = buildCatalogPlacement({ facilityId, scenarioId, groupId });
    void upsertLocalPlacement(placement);
  };

  const removeCatalogGroup = (groupId: string) => {
    const placement = configuration.placements.find((item) => item.catalogGroupId === groupId);
    if (!placement) return;
    void removeLocalPlacement(placement.id);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1440px] items-center gap-3 px-4 py-3">
          <Link href="/dashboard" className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-200 text-slate-600 hover:bg-slate-50">
            <ArrowLeftOutlined />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">Defense Configuration Studio</h1>
            <p className="truncate text-xs text-slate-600">GIS-first конфигуратор эшелонированной защиты</p>
          </div>
          <div className="flex items-center gap-2">
            {(["gis", "comparison", "drilldown"] as Stage[]).map((stage) => (
              <button
                key={stage}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm transition ${
                  view === stage ? "bg-sky-600 text-white" : "border border-slate-200 bg-white text-slate-700"
                }`}
                type="button"
                onClick={() => setView(stage)}
              >
                {stage === "gis" ? <EnvironmentOutlined /> : null}
                {stage === "comparison" ? <FundProjectionScreenOutlined /> : null}
                {stage === "drilldown" ? <RadarChartOutlined /> : null}
                {stageLabels[stage]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-4">
        <section className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-slate-500">Facility</span>
            <select
              className="h-9 w-full rounded border border-slate-300 px-2 text-sm"
              value={facilityId}
              onChange={(event) => void setFacilityId(event.target.value)}
            >
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-slate-500">Scenario</span>
            <select
              className="h-9 w-full rounded border border-slate-300 px-2 text-sm"
              value={scenarioId}
              onChange={(event) => void setScenarioId(event.target.value as DefenseScenarioId)}
            >
              {scenarioOptions.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-xs uppercase text-slate-500">Budget, RUB</span>
            <input
              className="h-9 w-full rounded border border-slate-300 px-2 text-sm"
              type="number"
              min={1_000_000}
              step={1_000_000}
              value={budgetRub}
              onChange={(event) => void setBudgetRub(Number(event.target.value))}
            />
          </label>

          <article className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">{selectedFacility?.name ?? "—"}</p>
            <p className="mt-1">Scenario placement count: {configuration.placements.length}</p>
            <p className="mt-1">Layer records: {layers?.layerCoverage.length ?? 0}</p>
          </article>
        </section>

        {error ? (
          <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
        ) : null}
        {loading ? (
          <div className="rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">Загрузка данных…</div>
        ) : null}

        <section className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 lg:grid-cols-[280px_1fr]">
          <aside className="rounded border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Selected echelon</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {selectedLayer.shortName} · {selectedLayer.name}
            </p>
            <p className="mt-1 text-xs text-slate-600">{selectedLayer.distanceBandM.label} от объекта</p>
            <p className="mt-3 text-xs text-slate-600">
              В конфигурации: <strong className="text-slate-900">{selectedLayerPlacements.length}</strong> средств
            </p>
          </aside>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">Каталог средств защиты по эшелону</h2>
                <p className="text-xs text-slate-600">
                  Выберите L1-L9 на GIS или ниже и добавьте группы СЗ в текущую конфигурацию.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {defenseLayers.map((layer) => (
                  <button
                    key={layer.id}
                    className={`rounded border px-2 py-1 text-xs font-semibold ${
                      layer.id === selectedLayerId
                        ? "border-sky-500 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                    type="button"
                    onClick={() => setSelectedLayerId(layer.id)}
                    title={`${layer.name}: ${layer.distanceBandM.label}`}
                  >
                    {layer.shortName}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {selectedLayerGroups.map((group) => {
                const placement = configuration.placements.find((item) => item.catalogGroupId === group.id);
                const isSelected = Boolean(placement);
                return (
                  <article key={group.id} className="rounded border border-slate-200 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{group.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Вес критерия {group.weightPct}% · {selectedLayer.distanceBandM.label}
                        </p>
                      </div>
                      <button
                        className={`shrink-0 rounded px-2 py-1 text-xs font-semibold ${
                          isSelected ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                        type="button"
                        onClick={() => (isSelected ? removeCatalogGroup(group.id) : addCatalogGroup(group.id))}
                      >
                        {isSelected ? "Убрать" : "Добавить"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <div className={view === "gis" ? "block" : "hidden"}>
          <GisBoard
            facilities={facilities}
            selectedFacilityId={facilityId}
            onSelectFacility={(nextId) => void setFacilityId(nextId)}
            hexCells={studioPreviewData.hexCells}
            threatRoutes={studioPreviewData.threatRoutes}
            layers={layers}
            configuration={configuration}
            catalog={catalog}
            selectedLayerId={selectedLayerId}
            selectedLayerGroups={selectedLayerGroups}
            onSelectLayer={setSelectedLayerId}
            onAddCatalogGroup={addCatalogGroup}
            onRemoveCatalogGroup={removeCatalogGroup}
          />
        </div>

        <div className={view === "comparison" ? "block" : "hidden"}>
          <ComparisonView
            kpiByScenario={kpiByScenario}
            layersByScenario={layersByScenario}
            recommendations={recommendations}
            budgetRub={budgetRub}
          />
        </div>

        <div className="block">
          {view === "drilldown" ? (
            <FacilityDrilldown
              key={`${facilityId}:${scenarioId}`}
              facilityName={selectedFacility?.name ?? "Facility"}
              scenario={scenarioId}
              configuration={configuration}
              onScenarioChange={(nextScenarioId) => void setScenarioId(nextScenarioId)}
              onLocalPlacementUpsert={(placement) => void upsertLocalPlacement(placement)}
              onLocalPlacementMove={(args) => void moveLocalPlacement(args)}
              onLocalPlacementRemove={(placementId) => void removeLocalPlacement(placementId)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
