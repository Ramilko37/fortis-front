"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  AppstoreOutlined,
  ArrowLeftOutlined,
  DatabaseOutlined,
  EnvironmentOutlined,
  ExportOutlined,
  FundProjectionScreenOutlined,
  RadarChartOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import {
  buildCatalogPlacement,
  defenseLayers,
  getCatalogGroupsForLayer,
  scenarioOptions,
} from "@/modules/drone-defense/infra/mock-defense-data";
import { useDefenseStudioStore, studioPreviewData } from "@/modules/drone-defense/domain/use-defense-studio-store";
import { buildEchelonMapModel, type EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import { ComparisonView } from "@/modules/drone-defense/ui/comparison-view";
import { FacilityDrilldown } from "@/modules/drone-defense/ui/facility-drilldown";
import { GisBoard } from "@/modules/drone-defense/ui/gis-board";
import type { DefenseLayerId, DefenseScenarioId } from "@/shared/types/drone-defense";

type Stage = "gis" | "comparison" | "drilldown";

export function DroneDefensePrototype() {
  const [selectedLayerId, setSelectedLayerId] = useState<DefenseLayerId>("layer_01_external_warning");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
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
  const filteredLayerGroups = useMemo(() => {
    const query = catalogQuery.trim().toLowerCase();
    if (!query) return selectedLayerGroups;
    return selectedLayerGroups.filter((group) => group.name.toLowerCase().includes(query));
  }, [catalogQuery, selectedLayerGroups]);
  const selectedLayerCoverage = layers?.layerCoverage.find((item) => item.layerId === selectedLayerId)?.coveredPct ?? 0;
  const echelonModel = useMemo(
    () =>
      buildEchelonMapModel({
        facility: selectedFacility,
        layers: defenseLayers,
        layerCoverage: layers,
        configuration,
        catalog,
        selectedLayerId,
        selectedSlotId,
      }),
    [catalog, configuration, layers, selectedFacility, selectedLayerId, selectedSlotId],
  );
  const selectedLayerSlots = useMemo(
    () => echelonModel.slots.filter((slot) => slot.layerId === selectedLayerId),
    [echelonModel.slots, selectedLayerId],
  );
  const selectedSlot = useMemo(
    () => selectedLayerSlots.find((slot) => slot.id === selectedSlotId) ?? selectedLayerSlots.find((slot) => slot.status === "empty") ?? selectedLayerSlots[0] ?? null,
    [selectedLayerSlots, selectedSlotId],
  );

  const addCatalogGroup = (groupId: string, targetSlot: EchelonMapSlot | null = selectedSlot) => {
    const placement = buildCatalogPlacement({
      facilityId,
      scenarioId,
      groupId,
      slotId: targetSlot?.id,
      mapRef: targetSlot ? { lon: targetSlot.position[0], lat: targetSlot.position[1] } : undefined,
    });
    void upsertLocalPlacement(placement);
  };

  const removeCatalogGroup = (groupId: string) => {
    const placement = configuration.placements.find((item) => item.catalogGroupId === groupId);
    if (!placement) return;
    void removeLocalPlacement(placement.id);
  };

  const selectLayerWithDefaultSlot = (layerId: DefenseLayerId) => {
    setSelectedLayerId(layerId);
    const nextSlot =
      echelonModel.slots.find((slot) => slot.layerId === layerId && slot.status === "empty") ??
      echelonModel.slots.find((slot) => slot.layerId === layerId) ??
      null;
    setSelectedSlotId(nextSlot?.id ?? null);
  };

  const railItems: Array<{ id: Stage; label: string; icon: ReactNode }> = [
    { id: "gis", label: "Карта", icon: <EnvironmentOutlined /> },
    { id: "comparison", label: "Сравнение", icon: <FundProjectionScreenOutlined /> },
    { id: "drilldown", label: "3D", icon: <RadarChartOutlined /> },
  ];

  return (
    <div className="h-screen overflow-hidden bg-[#eef3f8] text-slate-900">
      <div className="flex h-full min-h-0 flex-col lg:flex-row">
        <aside className="hidden w-[76px] shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm lg:flex">
          <div className="flex h-[74px] items-center justify-center border-b border-slate-100">
            <Link
              href="/dashboard"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              title="Назад"
            >
              <ArrowLeftOutlined />
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-2 px-2 py-4">
            {railItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`flex h-14 w-full flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold transition ${
                  view === item.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/25" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
                onClick={() => setView(item.id)}
                title={item.label}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="space-y-2 border-t border-slate-100 px-2 py-3">
            <button className="flex h-12 w-full items-center justify-center rounded-xl text-lg text-slate-400 hover:bg-slate-100" type="button" title="Сохранить">
              <SaveOutlined />
            </button>
            <button className="flex h-12 w-full items-center justify-center rounded-xl text-lg text-slate-400 hover:bg-slate-100" type="button" title="Экспорт">
              <ExportOutlined />
            </button>
          </div>
        </aside>

        <section className="z-10 flex max-h-[46vh] w-full shrink-0 flex-col border-b border-slate-200 bg-white shadow-xl shadow-slate-900/5 lg:h-full lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
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

            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 lg:hidden">
              {railItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`h-9 rounded-lg text-xs font-semibold ${view === item.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                  onClick={() => setView(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="sticky top-0 z-10 border-b border-blue-100 bg-blue-50/95 px-4 py-3 backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Активный эшелон</p>
              <p className="mt-0.5 text-sm font-semibold text-blue-950">
                Вы на {selectedLayer.shortName} · {selectedLayer.name} · {selectedSlot?.label ?? "слот не выбран"}
              </p>
            </div>

            <div className="border-b border-slate-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Контекст расчёта</p>
              <label className="mt-3 block text-xs font-medium text-slate-500">
                Объект
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
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
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-xs font-medium text-slate-500">
                  Сценарий
                  <select
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
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
                <label className="block text-xs font-medium text-slate-500">
                  Бюджет
                  <input
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900"
                    type="number"
                    min={1_000_000}
                    step={1_000_000}
                    value={budgetRub}
                    onChange={(event) => void setBudgetRub(Number(event.target.value))}
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Размещено</p>
                  <p className="text-base font-semibold text-slate-900">{configuration.placements.length}</p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-slate-400">Readiness</p>
                  <p className="text-base font-semibold text-slate-900">{Math.round(selectedLayerCoverage * 100)}%</p>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Слои L1-L9</p>
                <DatabaseOutlined className="text-slate-400" />
              </div>
              <div className="mt-3 space-y-1.5">
                {defenseLayers.map((layer) => {
                  const coverage = layers?.layerCoverage.find((item) => item.layerId === layer.id)?.coveredPct ?? 0;
                  const layerSlots = echelonModel.slots.filter((slot) => slot.layerId === layer.id);
                  const occupiedSlots = layerSlots.filter((slot) => slot.status === "occupied").length;
                  return (
                    <button
                      key={layer.id}
                      type="button"
                      className={`grid w-full grid-cols-[2.75rem_1fr_auto] items-center gap-2 rounded-lg border px-2 py-2 text-left transition ${
                        selectedLayerId === layer.id
                          ? "border-blue-400 bg-blue-50 text-blue-900"
                          : "border-slate-100 bg-white text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                      }`}
                      onClick={() => selectLayerWithDefaultSlot(layer.id)}
                    >
                      <span className="rounded-md bg-slate-900 px-1.5 py-1 text-center text-[11px] font-bold text-white">{layer.shortName}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{layer.name}</span>
                        <span className="block truncate text-[11px] text-slate-500">{layer.distanceBandM.label}</span>
                      </span>
                      <span className="text-right text-[11px] text-slate-500">
                        {Math.round(coverage * 100)}%
                        <span className="block">{occupiedSlots}/{layerSlots.length} слотов</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Каталог СЗ</p>
                  <h2 className="mt-1 text-sm font-semibold text-slate-950">
                    {selectedLayer.shortName} · {selectedLayer.name} · {selectedSlot?.label ?? "слот не выбран"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {selectedLayer.distanceBandM.label} от объекта · {selectedSlot?.status === "occupied" ? "слот занят" : "слот доступен"}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {selectedLayerSlots.filter((slot) => slot.status === "occupied").length}/{selectedLayerSlots.length} слотов
                </span>
              </div>
              <input
                className="mt-3 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-400"
                value={catalogQuery}
                onChange={(event) => setCatalogQuery(event.target.value)}
                placeholder="Найти средство защиты..."
              />
              <div className="mt-3 space-y-2">
                {filteredLayerGroups.map((group) => {
                  const placement = configuration.placements.find((item) => item.catalogGroupId === group.id);
                  const isSelected = Boolean(placement && (!selectedSlot || placement.slotId === selectedSlot.id));
                  const isBlockedByOccupiedSlot = Boolean(selectedSlot?.status === "occupied" && !isSelected);
                  return (
                    <article key={group.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">{group.name}</p>
                          <p className="mt-1 text-xs text-slate-500">Вес критерия {group.weightPct}%</p>
                        </div>
                        <button
                          className={`h-8 shrink-0 rounded-lg px-2 text-xs font-semibold ${
                            isSelected ? "bg-rose-50 text-rose-700" : "bg-blue-600 text-white"
                          } disabled:bg-slate-100 disabled:text-slate-400`}
                          type="button"
                          disabled={isBlockedByOccupiedSlot}
                          onClick={() => (isSelected ? removeCatalogGroup(group.id) : addCatalogGroup(group.id))}
                        >
                          {isSelected ? "Убрать" : isBlockedByOccupiedSlot ? "Слот занят" : selectedSlot ? `В ${selectedSlot.label}` : "Поставить"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
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
            <GisBoard
              className="h-full min-h-0 rounded-none border-0"
              facilities={facilities}
              selectedFacilityId={facilityId}
              onSelectFacility={(nextId) => void setFacilityId(nextId)}
              hexCells={studioPreviewData.hexCells}
              threatRoutes={studioPreviewData.threatRoutes}
              layers={layers}
              configuration={configuration}
              catalog={catalog}
              selectedLayerId={selectedLayerId}
              selectedSlotId={selectedSlotId}
              selectedLayerGroups={selectedLayerGroups}
              onSelectLayer={selectLayerWithDefaultSlot}
              onSelectSlot={(slot) => {
                setSelectedLayerId(slot.layerId);
                setSelectedSlotId(slot.id);
              }}
              onAddCatalogGroup={addCatalogGroup}
              onRemoveCatalogGroup={removeCatalogGroup}
              onOpenComparison={() => setView("comparison")}
              onOpenDrilldown={() => setView("drilldown")}
            />
          ) : null}

          {view === "comparison" ? (
            <div className="h-full overflow-auto bg-slate-50 p-4">
              <ComparisonView
                kpiByScenario={kpiByScenario}
                layersByScenario={layersByScenario}
                recommendations={recommendations}
                budgetRub={budgetRub}
              />
            </div>
          ) : null}

          {view === "drilldown" ? (
            <div className="h-full overflow-auto bg-slate-50 p-4">
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
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
