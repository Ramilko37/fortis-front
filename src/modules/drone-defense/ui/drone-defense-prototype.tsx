"use client";

import { useEffect, useMemo, useState } from "react";
import { AppstoreOutlined } from "@ant-design/icons";
import {
  buildCatalogPlacement,
  defenseLayers,
  getCatalogGroupsForLayer,
  type EchelonCatalogGroup,
} from "@/modules/drone-defense/infra/mock-defense-data";
import { useDefenseStudioStore, studioPreviewData } from "@/modules/drone-defense/domain/use-defense-studio-store";
import { buildEchelonMapModel, type EchelonMapSlot } from "@/modules/drone-defense/domain/echelon-map-model";
import { DefenseToolsPanel } from "@/modules/drone-defense/ui/defense-tools-panel";
import { FacilityDrilldown } from "@/modules/drone-defense/ui/facility-drilldown";
import { GisBoard } from "@/modules/drone-defense/ui/gis-board";
import { getDefenseItemByMapGroupId, getDefenseItemById } from "@/shared/config/defense-catalog";
import { useDefenseConfigurationStore } from "@/shared/lib/use-defense-configuration-store";
import type { DefenseLayerId } from "@/shared/types/drone-defense";

export function DroneDefensePrototype() {
  const [selectedLayerId, setSelectedLayerId] = useState<DefenseLayerId>("layer_01_external_warning");
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [activeToolId, setActiveToolId] = useState<string | null>(null);
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
    setView,
    setFacilityId,
    setScenarioId,
    upsertLocalPlacement,
    moveLocalPlacement,
    removeLocalPlacement,
  } = useDefenseStudioStore();
  const {
    configuration: sharedConfiguration,
    addDefenseItem,
    removeDefenseItem,
    restoreConfigurationFromLocalStorage,
  } = useDefenseConfigurationStore();

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    restoreConfigurationFromLocalStorage();
  }, [restoreConfigurationFromLocalStorage]);

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
  const placementHint = lastPlacementMessage ?? `Эшелон ${selectedLayer.shortName} · Добавьте или удалите средства защиты в сетке`;
  const sharedCatalogPlacements = useMemo(
    () =>
      Object.entries(sharedConfiguration.selectedItems).flatMap(([itemId, quantity]) => {
        const item = getDefenseItemById(itemId);
        const groupId = item?.mapCatalogGroupIds[0];
        if (!item || !groupId || quantity <= 0) return [];
        const layerGroups = getCatalogGroupsForLayer(item.layerId ?? selectedLayerId);
        const slotIndex = Math.max(0, layerGroups.findIndex((group) => group.id === groupId));
        const slotId = item.layerId ? `${item.layerId}-slot-${String(slotIndex + 1).padStart(2, "0")}` : undefined;
        return [
          {
            ...buildCatalogPlacement({
              facilityId,
              scenarioId,
              groupId,
              slotId,
            }),
            qty: quantity,
          },
        ];
      }),
    [facilityId, scenarioId, selectedLayerId, sharedConfiguration.selectedItems],
  );
  const localScenePlacements = useMemo(
    () => studioConfiguration.placements.filter((placement) => placement.id.startsWith("local-")),
    [studioConfiguration.placements],
  );
  const mapConfiguration = useMemo(
    () => ({
      ...studioConfiguration,
      placements: [...sharedCatalogPlacements, ...localScenePlacements],
    }),
    [localScenePlacements, sharedCatalogPlacements, studioConfiguration],
  );
  const echelonModel = useMemo(
    () =>
      buildEchelonMapModel({
        facility: selectedFacility,
        layers: defenseLayers,
        layerCoverage: layers,
        configuration: mapConfiguration,
        catalog,
        selectedLayerId,
        selectedSlotId,
      }),
    [catalog, mapConfiguration, layers, selectedFacility, selectedLayerId, selectedSlotId],
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

  const handleSelectTool = (group: EchelonCatalogGroup) => {
    setActiveToolId((current) => (current === group.id ? null : group.id));
    setLastPlacementMessage(`${selectedLayer.shortName} · ${group.name}: используйте + или −`);
  };

  const addToolToSlot = (group: EchelonCatalogGroup, slot: EchelonMapSlot) => {
    setSelectedLayerId(slot.layerId);
    setSelectedSlotId(slot.id);
    setActiveToolId(group.id);
    const item = getDefenseItemByMapGroupId(group.id);
    if (item) {
      addDefenseItem(item.id);
      setLastPlacementMessage(`${group.name} добавлено в общую конфигурацию`);
      return;
    }
    if (mapConfiguration.placements.some((placement) => placement.slotId === slot.id)) {
      setLastPlacementMessage(`${slot.label} уже занят`);
      return;
    }

    addCatalogGroup(group.id, slot);
    setLastPlacementMessage(`${group.name} построено на ${selectedLayer.shortName} · ${slot.label}`);
  };

  const removeCatalogGroup = (groupId: string) => {
    const item = getDefenseItemByMapGroupId(groupId);
    if (item) {
      removeDefenseItem(item.id);
      setLastPlacementMessage(`${item.title} удалено из общей конфигурации`);
      return;
    }
    const placement = mapConfiguration.placements.find((item) => item.catalogGroupId === groupId);
    if (!placement) return;
    void removeLocalPlacement(placement.id);
    setLastPlacementMessage(`${placement.catalogGroupName ?? "Средство защиты"} удалено`);
  };

  const selectLayerWithDefaultSlot = (layerId: DefenseLayerId) => {
    setSelectedLayerId(layerId);
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 border-b border-blue-100 bg-blue-50/95 px-4 py-3 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Активный эшелон</p>
            <p className="mt-0.5 text-sm font-semibold text-blue-950">
              {placementHint}
            </p>
          </div>

          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Каталог СЗ</p>
                <h2 className="mt-1 text-sm font-semibold text-slate-950">
                  {selectedLayer.shortName} · {selectedLayer.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedLayer.distanceBandM.label} от объекта · стройте и удаляйте через +/−
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
            <div className="mt-3">
              <DefenseToolsPanel
                groups={filteredLayerGroups}
                slots={selectedLayerSlots}
                placements={mapConfiguration.placements}
                selectedToolId={activeToolId}
                onSelectTool={handleSelectTool}
                onAddTool={addToolToSlot}
                onRemoveTool={(group) => removeCatalogGroup(group.id)}
              />
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
            configuration={mapConfiguration}
            catalog={catalog}
            selectedLayerId={selectedLayerId}
            selectedSlotId={selectedSlotId}
            activeToolId={activeToolId}
            placementHint={placementHint}
            onSelectLayer={selectLayerWithDefaultSlot}
            onSelectSlot={(slot) => {
              setSelectedLayerId(slot.layerId);
              setSelectedSlotId(slot.id);
            }}
            onSelectTool={(groupId) => {
              setActiveToolId(groupId);
              const group = selectedLayerGroups.find((item) => item.id === groupId);
              setLastPlacementMessage(group ? `${selectedLayer.shortName} · ${group.name}: используйте + или −` : null);
            }}
            onRemoveCatalogGroup={removeCatalogGroup}
            onOpenDrilldown={() => setView("drilldown")}
          />
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
      </main>
    </div>
  );
}
