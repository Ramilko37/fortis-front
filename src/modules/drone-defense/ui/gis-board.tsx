"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Layer } from "@deck.gl/core";
import MaplibreMap from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import {
  defenseLayers,
  getCatalogGroupsForLayer,
  type EchelonCatalogGroup,
} from "@/modules/drone-defense/infra/mock-defense-data";
import {
  buildEchelonMapModel,
  buildLayerFocusViewState,
  getSlotBuildProfile,
  type EchelonMapPlacement,
  type EchelonMapSlot,
  type EchelonZone,
  type LayerFocusViewState,
} from "@/modules/drone-defense/domain/echelon-map-model";
import {
  getBuildAssetForCatalogGroup,
  getBuildOptionForSlot,
  type BuildAssetIcon,
  type SlotBuildOption,
} from "@/modules/drone-defense/domain/echelon-build-assets";
import type {
  Configuration,
  DefenseCatalogResponse,
  DefenseLayerId,
  DefenseLayersResponse,
  Facility,
  HexCell,
  ThreatRoute,
} from "@/shared/types/drone-defense";

type GisBoardProps = {
  className?: string;
  facilities: Facility[];
  selectedFacilityId: string;
  onSelectFacility: (facilityId: string) => void;
  hexCells: HexCell[];
  threatRoutes: ThreatRoute[];
  layers: DefenseLayersResponse | null;
  configuration: Configuration;
  catalog: DefenseCatalogResponse | null;
  selectedLayerId: DefenseLayerId;
  selectedSlotId: string | null;
  selectedLayerGroups: EchelonCatalogGroup[];
  onSelectLayer: (layerId: DefenseLayerId) => void;
  onSelectSlot: (slot: EchelonMapSlot) => void;
  onAddCatalogGroup: (groupId: string, slot?: EchelonMapSlot) => void;
  onRemoveCatalogGroup: (groupId: string) => void;
  onOpenComparison?: () => void;
  onOpenDrilldown?: () => void;
};

const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function hexCoverageByLayer(layerCoverage: DefenseLayersResponse | null) {
  if (!layerCoverage) return 0;
  const total = layerCoverage.layerCoverage.reduce((acc, item) => acc + item.coveredPct, 0);
  return total / Math.max(layerCoverage.layerCoverage.length, 1);
}

function readinessClassName(coveredPct: number) {
  if (coveredPct >= 0.55) return "bg-emerald-100 text-emerald-700";
  if (coveredPct >= 0.28) return "bg-amber-100 text-amber-700";
  if (coveredPct > 0) return "bg-orange-100 text-orange-700";
  return "bg-slate-100 text-slate-500";
}

function readinessLabel(coveredPct: number) {
  if (coveredPct >= 0.55) return "covered";
  if (coveredPct >= 0.28) return "partial";
  if (coveredPct > 0) return "weak";
  return "missing";
}

const fallbackViewState: LayerFocusViewState = {
  longitude: 60.5945,
  latitude: 56.8389,
  zoom: 7.2,
  pitch: 28,
  bearing: 0,
};

const layerFocusTransitionDurationMs = 1600;

function linearEasing(value: number) {
  return value;
}

function normalizeViewState(viewState: LayerFocusViewState): LayerFocusViewState {
  return {
    longitude: viewState.longitude,
    latitude: viewState.latitude,
    zoom: viewState.zoom,
    pitch: viewState.pitch ?? 28,
    bearing: viewState.bearing ?? 0,
  };
}

function interpolateViewState(from: LayerFocusViewState, to: LayerFocusViewState, progress: number): LayerFocusViewState {
  return {
    longitude: from.longitude + (to.longitude - from.longitude) * progress,
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    zoom: from.zoom + (to.zoom - from.zoom) * progress,
    pitch: (from.pitch ?? 28) + ((to.pitch ?? 28) - (from.pitch ?? 28)) * progress,
    bearing: (from.bearing ?? 0) + ((to.bearing ?? 0) - (from.bearing ?? 0)) * progress,
  };
}

type SlotBuildIcon = {
  slot: EchelonMapSlot;
  option: SlotBuildOption;
};

type BuiltPlacementIcon = {
  placement: EchelonMapPlacement;
  asset: BuildAssetIcon;
};

export function GisBoard({
  className = "",
  facilities,
  selectedFacilityId,
  onSelectFacility,
  hexCells,
  threatRoutes,
  layers,
  configuration,
  catalog,
  selectedLayerId,
  selectedSlotId,
  selectedLayerGroups,
  onSelectLayer,
  onSelectSlot,
  onAddCatalogGroup,
  onRemoveCatalogGroup,
  onOpenComparison,
  onOpenDrilldown,
}: GisBoardProps) {
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [viewState, setViewState] = useState<LayerFocusViewState>(fallbackViewState);
  const viewStateRef = useRef<LayerFocusViewState>(fallbackViewState);
  const animationFrameRef = useRef<number | null>(null);
  const isAnimatingFocusRef = useRef(false);

  const selectedFacility = facilities.find((item) => item.id === selectedFacilityId);
  const visibleFacilities = useMemo(() => (selectedFacility ? [selectedFacility] : []), [selectedFacility]);
  const buildableCatalogGroups = useMemo(
    () => defenseLayers.flatMap((layer) => getCatalogGroupsForLayer(layer.id)),
    [],
  );
  const layerCoverage = hexCoverageByLayer(layers);
  const selectedLayer = defenseLayers.find((layer) => layer.id === selectedLayerId) ?? defenseLayers[0];
  const selectedLayerPlacements = configuration.placements.filter((placement) => placement.layerId === selectedLayerId);
  const nextGroupToPlace = selectedLayerGroups.find(
    (group) => !configuration.placements.some((placement) => placement.catalogGroupId === group.id),
  );
  const echelonModel = useMemo(
    () =>
      buildEchelonMapModel({
        facility: selectedFacility ?? null,
        layers: defenseLayers,
        layerCoverage: layers,
        configuration,
        catalog,
        selectedLayerId,
        selectedSlotId,
      }),
    [catalog, configuration, layers, selectedFacility, selectedLayerId, selectedSlotId],
  );
  const selectedSlot = useMemo(
    () => echelonModel.slots.find((slot) => slot.id === selectedSlotId) ?? null,
    [echelonModel.slots, selectedSlotId],
  );
  const removableLayerPlacement =
    configuration.placements.find((placement) => placement.slotId === selectedSlotId && placement.catalogGroupId) ??
    selectedLayerPlacements.find((placement) => placement.catalogGroupId);

  const filteredHexes = useMemo(
    () => hexCells.filter((cell) => cell.facilityId === selectedFacilityId),
    [hexCells, selectedFacilityId],
  );
  const filteredRoutes = useMemo(
    () => threatRoutes.filter((route) => route.facilityId === selectedFacilityId),
    [threatRoutes, selectedFacilityId],
  );

  const focusedViewState = useMemo(
    () =>
      selectedFacility
        ? buildLayerFocusViewState({
            facility: selectedFacility,
            layer: selectedLayer,
          })
        : fallbackViewState,
    [selectedFacility, selectedLayer],
  );

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    isAnimatingFocusRef.current = true;

    const from = normalizeViewState(viewStateRef.current);
    const to = normalizeViewState(focusedViewState);
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const progress = Math.min(elapsed / layerFocusTransitionDurationMs, 1);
      const nextViewState = interpolateViewState(from, to, linearEasing(progress));

      viewStateRef.current = nextViewState;
      setViewState(nextViewState);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
        return;
      }

      isAnimatingFocusRef.current = false;
      animationFrameRef.current = null;
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isAnimatingFocusRef.current = false;
    };
  }, [focusedViewState]);

  const zoomReadout = viewState.zoom;
  const iconPlacements = useMemo(
    () =>
      echelonModel.placements
        .map((placement) => ({
          placement,
          asset: placement.catalogGroupId ? getBuildAssetForCatalogGroup(placement.catalogGroupId) : null,
        }))
        .filter((item): item is BuiltPlacementIcon => Boolean(item.asset)),
    [echelonModel.placements],
  );

  const deckLayers = useMemo(
    () =>
      [
        ...echelonModel.zones.flatMap((zone) => {
          const layerSlug = zone.shortName.toLowerCase();
          const isActive = zone.layerId === selectedLayerId;
          const zoneLayer = defenseLayers.find((layer) => layer.id === zone.layerId);
          const isFilledDiskZone = (zoneLayer?.distanceBandM.min ?? 0) <= 0;
          const zoneSlots = echelonModel.slots.filter((slot) => slot.layerId === zone.layerId);
          const buildSlots = zoneSlots
            .map((slot) => ({
              slot,
              option: getBuildOptionForSlot({
                slot,
                catalogGroups: buildableCatalogGroups,
                placements: configuration.placements,
              }),
            }))
            .filter((item): item is SlotBuildIcon => isActive && Boolean(item.option));
          const zoneFillColor = (item: EchelonZone) =>
            isActive
              ? ([item.fillColor[0], item.fillColor[1], item.fillColor[2], 132] as [number, number, number, number])
              : ([item.fillColor[0], item.fillColor[1], item.fillColor[2], 28] as [number, number, number, number]);
          const zoneLineColor = (item: EchelonZone) =>
            isActive
              ? ([15, 23, 42, 255] as [number, number, number, number])
              : ([item.lineColor[0], item.lineColor[1], item.lineColor[2], 90] as [number, number, number, number]);
          const handleZoneClick = (object: EchelonZone | null | undefined) => {
            if (!object) return;
            onSelectLayer(object.layerId);
          };
          const handleZoneHover = (object: EchelonZone | null | undefined) =>
            setHoverLabel(
              object
                ? `${object.shortName}: ${object.name}, ${object.distanceLabel}, слотов ${zoneSlots.length}`
                : null,
            );
          const handleSlotClick = (object: EchelonMapSlot | null | undefined) => {
            if (!object) return;

            onSelectSlot(object);

            const option = getBuildOptionForSlot({
              slot: object,
              catalogGroups: buildableCatalogGroups,
              placements: configuration.placements,
            });

            if (option) {
              onAddCatalogGroup(option.groupId, object);
            }
          };
          const getSlotBuildTitle = (slot: EchelonMapSlot) => {
            const option = getBuildOptionForSlot({
              slot,
              catalogGroups: buildableCatalogGroups,
              placements: configuration.placements,
            });
            const profile = getSlotBuildProfile(slot.layerId);

            if (slot.status === "occupied") return `${zone.shortName} · ${slot.label}: построено`;
            if (!option) return `${zone.shortName} · ${slot.label}: все юниты эшелона построены`;
            return `${profile.title}: ${option.label}`;
          };
          return [
            isFilledDiskZone
              ? new ScatterplotLayer<EchelonZone>({
                  id: `echelon-${layerSlug}-zone`,
                  data: [zone],
                  pickable: true,
                  filled: true,
                  stroked: true,
                  getPosition: () => [selectedFacility?.center.lon ?? 0, selectedFacility?.center.lat ?? 0],
                  getRadius: () => zoneLayer?.distanceBandM.max ?? 100,
                  radiusUnits: "meters",
                  getFillColor: zoneFillColor,
                  getLineColor: zoneLineColor,
                  getLineWidth: () => (isActive ? 4 : 1.5),
                  lineWidthUnits: "pixels",
                  onClick: ({ object }) => handleZoneClick(object),
                  onHover: ({ object }) => handleZoneHover(object),
                })
              : new PolygonLayer<EchelonZone>({
                  id: `echelon-${layerSlug}-zone`,
                  data: [zone],
                  pickable: true,
                  stroked: true,
                  filled: true,
                  extruded: false,
                  getPolygon: (item) => item.polygon,
                  getFillColor: zoneFillColor,
                  getLineColor: zoneLineColor,
                  getLineWidth: () => (isActive ? 4 : 1.5),
                  lineWidthUnits: "pixels",
                  onClick: ({ object }) => handleZoneClick(object),
                  onHover: ({ object }) => handleZoneHover(object),
                }),
            new ScatterplotLayer<EchelonMapSlot>({
              id: `echelon-${layerSlug}-slots`,
              data: zoneSlots,
              getPosition: (item) => item.position,
              getRadius: (item) => (item.status === "selected" ? 2400 : item.status === "occupied" ? 2100 : 1600),
              radiusMinPixels: 8,
              radiusMaxPixels: 18,
              getFillColor: (item) =>
                isActive
                  ? item.color
                  : [item.color[0], item.color[1], item.color[2], item.status === "occupied" ? 145 : 90],
              getLineColor: (item) => {
                if (item.status === "selected") return [15, 23, 42, 255];
                if (item.status === "occupied") return [255, 255, 255, 245];
                return isActive ? zone.lineColor : [148, 163, 184, 120];
              },
              lineWidthMinPixels: 2,
              stroked: true,
              pickable: true,
              onClick: ({ object }) => handleSlotClick(object),
              onHover: ({ object }) =>
                setHoverLabel(object ? getSlotBuildTitle(object) : null),
            }),
            new IconLayer<SlotBuildIcon>({
              id: `echelon-${layerSlug}-build-icons`,
              data: buildSlots,
              getPosition: (item) => item.slot.position,
              getIcon: (item) => ({
                url: item.option.imageUrl,
                width: 128,
                height: 128,
                anchorY: 64,
              }),
              getSize: (item) => (item.slot.status === "selected" ? 52 : 46),
              sizeUnits: "pixels",
              billboard: true,
              pickable: true,
              onClick: ({ object }) => handleSlotClick(object?.slot),
              onHover: ({ object }) =>
                setHoverLabel(object ? `Построить: ${object.option.label}` : null),
            }),
            new TextLayer<EchelonMapSlot>({
              id: `echelon-${layerSlug}-slot-labels`,
              data: zoneSlots.filter((slot) => {
                if (!isActive) return true;
                const buildOption = getBuildOptionForSlot({
                  slot,
                  catalogGroups: buildableCatalogGroups,
                  placements: configuration.placements,
                });
                const builtAsset = slot.catalogGroupId ? getBuildAssetForCatalogGroup(slot.catalogGroupId) : null;
                return !buildOption && !builtAsset;
              }),
              getPosition: (item) => item.position,
              getText: (item) => (item.status === "occupied" ? item.label : getSlotBuildProfile(item.layerId).glyph),
              getColor: (item) =>
                item.status === "occupied"
                  ? [15, 23, 42, 255]
                  : item.status === "selected"
                    ? [255, 255, 255, 255]
                    : isActive
                      ? [15, 23, 42, 255]
                      : [71, 85, 105, 170],
              getSize: (item) => (item.status === "occupied" ? 10 : item.status === "selected" ? 11 : 10),
              getTextAnchor: "middle",
              getAlignmentBaseline: "center",
              background: true,
              getBackgroundColor: (item) =>
                item.status === "occupied"
                  ? [255, 255, 255, 0]
                  : item.status === "selected"
                    ? [15, 23, 42, 235]
                    : isActive
                      ? [255, 255, 255, 230]
                      : [255, 255, 255, 175],
              backgroundPadding: [4, 2],
              pickable: true,
              onClick: ({ object }) => handleSlotClick(object),
              onHover: ({ object }) => setHoverLabel(object ? getSlotBuildTitle(object) : null),
            }),
          ];
        }),
        new H3HexagonLayer<HexCell>({
          id: "regional-h3-gaps",
          data: filteredHexes,
          getHexagon: (item) => item.id,
          pickable: true,
          extruded: false,
          stroked: true,
          getFillColor: (item) => {
            const avgRisk =
              (item.baseRisk.fixedWing + item.baseRisk.fpv + item.baseRisk.loitering + item.baseRisk.swarm) / 4;
            const riskAdjusted = Math.max(0, Math.min(1, avgRisk * (1 - layerCoverage)));
            const red = Math.round(190 + 45 * riskAdjusted);
            const green = Math.round(220 - 130 * riskAdjusted);
            const blue = Math.round(255 - 170 * riskAdjusted);
            return [red, green, blue, 145];
          },
          getLineColor: [132, 146, 176, 180],
          lineWidthMinPixels: 1,
          onHover: ({ object }) => setHoverLabel(object ? `H3 ${object.id}` : null),
        }),
        new IconLayer<BuiltPlacementIcon>({
          id: "echelon-built-asset-icons",
          data: iconPlacements,
          getPosition: (item) => item.placement.position,
          getIcon: (item) => ({
            url: item.asset.imageUrl,
            width: 128,
            height: 128,
            anchorY: 64,
          }),
          getSize: (item) => (item.placement.layerId === selectedLayerId ? 50 : 36),
          sizeUnits: "pixels",
          billboard: true,
          pickable: true,
          onClick: ({ object }) => {
            const slot = object?.placement.slotId
              ? echelonModel.slots.find((item) => item.id === object.placement.slotId)
              : null;
            if (slot) {
              onSelectSlot(slot);
            }
          },
          onHover: ({ object }) => setHoverLabel(object ? object.placement.label : null),
        }),
        new ScatterplotLayer<EchelonMapPlacement>({
          id: "echelon-placement-objects",
          data: echelonModel.placements,
          getPosition: (item) => item.position,
          getRadius: (item) => (item.layerId === selectedLayerId ? 1700 : 1150),
          radiusMinPixels: 5,
          radiusMaxPixels: 14,
          getFillColor: (item) => (item.catalogGroupId ? [255, 255, 255, 0] : item.color),
          getLineColor: (item) => (item.layerId === selectedLayerId ? [15, 23, 42, 255] : [255, 255, 255, 220]),
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
            const slot = object.slotId ? echelonModel.slots.find((item) => item.id === object.slotId) : null;
            if (slot) {
              onSelectSlot(slot);
              return;
            }
            onSelectLayer(object.layerId);
          },
          onHover: ({ object }) =>
            setHoverLabel(object ? `${object.label} · ${defenseLayers.find((layer) => layer.id === object.layerId)?.shortName}` : null),
        }),
        new TextLayer<EchelonMapPlacement>({
          id: "echelon-placement-labels",
          data: echelonModel.placements.filter((item) => item.layerId === selectedLayerId),
          getPosition: (item) => item.position,
          getText: (item) => item.label,
          getColor: [15, 23, 42, 255],
          getSize: 11,
          getTextAnchor: "start",
          getAlignmentBaseline: "center",
          getPixelOffset: [9, 0],
          background: true,
          getBackgroundColor: [255, 255, 255, 220],
          backgroundPadding: [3, 2],
        }),
        new PathLayer<ThreatRoute>({
          id: "threat-corridors",
          data: filteredRoutes,
          getPath: (item) => item.path.map((point) => [point.lon, point.lat] as [number, number]),
          getColor: [255, 118, 102, 220],
          widthUnits: "pixels",
          getWidth: 3,
          pickable: true,
          onHover: ({ object }) => setHoverLabel(object ? `Маршрут угрозы: ${object.id}` : null),
        }),
        new ScatterplotLayer<Facility>({
          id: "facility-nodes",
          data: visibleFacilities,
          getPosition: (item) => [item.center.lon, item.center.lat],
          getRadius: 9000,
          radiusMinPixels: 6,
          radiusMaxPixels: 20,
          getFillColor: [0, 174, 255, 255],
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
            onSelectFacility(object.id);
          },
          onHover: ({ object }) => setHoverLabel(object ? object.name : null),
        }),
        new TextLayer<Facility>({
          id: "facility-labels",
          data: visibleFacilities,
          getPosition: (item) => [item.center.lon, item.center.lat],
          getText: (item) => item.name,
          getColor: [30, 41, 59, 255],
          getSize: 12,
          getTextAnchor: "start",
          getAlignmentBaseline: "bottom",
          getPixelOffset: [12, -12],
        }),
      ] satisfies Layer[],
    [
      echelonModel,
      buildableCatalogGroups,
      configuration.placements,
      filteredHexes,
      filteredRoutes,
      iconPlacements,
      layerCoverage,
      onAddCatalogGroup,
      onSelectFacility,
      onSelectLayer,
      onSelectSlot,
      selectedFacility?.center.lat,
      selectedFacility?.center.lon,
      selectedLayerId,
      visibleFacilities,
    ],
  );

  return (
    <section className={`relative h-[calc(100vh-11.5rem)] min-h-[540px] overflow-hidden rounded-lg border border-slate-200 ${className}`}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: nextViewState }) => {
          if (isAnimatingFocusRef.current) return;

          const nextMapViewState = nextViewState as LayerFocusViewState;
          if (animationFrameRef.current !== null) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }

          const normalizedNextViewState = normalizeViewState(nextMapViewState);
          viewStateRef.current = normalizedNextViewState;
          setViewState(normalizedNextViewState);
        }}
        controller
        layers={deckLayers}
      >
        <MaplibreMap mapStyle={mapStyle} />
      </DeckGL>

      <div className="absolute left-4 top-4 z-10 flex max-w-[min(42rem,calc(100%-2rem))] flex-wrap items-center gap-2">
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-lg bg-white/95 text-lg text-slate-500 shadow-md shadow-slate-900/10 backdrop-blur hover:text-slate-900"
          title="Поиск по карте"
        >
          ⌕
        </button>
        <div className="rounded-lg border border-white/60 bg-white/95 px-3 py-2 text-xs shadow-md shadow-slate-900/10 backdrop-blur">
          <p className="font-semibold text-slate-950">{selectedFacility?.name ?? "Facility"}</p>
          <p className="text-slate-500">
            {selectedLayer.shortName} · {selectedSlot?.label ?? "слот не выбран"} · {selectedLayer.distanceBandM.label}
          </p>
        </div>
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/25" type="button">
          Опубликовать
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-lg bg-white/95 text-slate-500 shadow-md shadow-slate-900/10" type="button" title="На весь экран">
          ⛶
        </button>
        <button className="grid h-10 w-10 place-items-center rounded-lg bg-white/95 text-slate-500 shadow-md shadow-slate-900/10" type="button" title="Информация">
          i
        </button>
      </div>

      <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-white/70 bg-white/95 p-1 shadow-lg shadow-slate-900/15 backdrop-blur">
        {defenseLayers.map((layer) => {
          const layerItem = layers?.layerCoverage.find((item) => item.layerId === layer.id);
          const coverage = layerItem?.coveredPct ?? 0;
          return (
            <button
              key={layer.id}
              type="button"
              className={`h-9 min-w-10 rounded-md px-2 text-[11px] font-bold transition ${
                selectedLayerId === layer.id ? "bg-slate-900 text-white" : readinessClassName(coverage)
              }`}
              onClick={() => onSelectLayer(layer.id)}
              title={`${layer.name}: ${readinessLabel(coverage)} (${Math.round(coverage * 100)}%)`}
            >
              {layer.shortName}
            </button>
          );
        })}
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button
          className="h-9 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          type="button"
          onClick={() => nextGroupToPlace && onAddCatalogGroup(nextGroupToPlace.id)}
          disabled={!nextGroupToPlace || selectedSlot?.status === "occupied"}
          title={
            selectedSlot?.status === "occupied"
              ? "Выбранный слот уже занят"
              : nextGroupToPlace
                ? `Поставить: ${nextGroupToPlace.name}`
                : "Все группы выбранного эшелона уже поставлены"
          }
        >
          Поставить
        </button>
        <button
          className="h-9 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
          type="button"
          onClick={() => removableLayerPlacement?.catalogGroupId && onRemoveCatalogGroup(removableLayerPlacement.catalogGroupId)}
          disabled={!removableLayerPlacement?.catalogGroupId}
        >
          Убрать
        </button>
        <button className="h-9 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onOpenComparison}>
          Сравнить
        </button>
        <button className="h-9 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100" type="button" onClick={onOpenDrilldown}>
          3D
        </button>
      </div>

      <div className="absolute bottom-5 right-4 z-10 flex flex-col overflow-hidden rounded-lg bg-white/95 text-slate-500 shadow-md shadow-slate-900/10">
        <button className="grid h-10 w-10 place-items-center border-b border-slate-100 text-lg" type="button">+</button>
        <button className="grid h-10 w-10 place-items-center border-b border-slate-100 text-xs font-semibold" type="button">
          {zoomReadout.toFixed(1)}
        </button>
        <button className="grid h-10 w-10 place-items-center text-lg" type="button">−</button>
      </div>

      <div className="absolute bottom-5 left-4 z-10 rounded bg-white/90 px-3 py-1.5 text-[11px] text-slate-600 shadow">
        1000 км
      </div>

      {hoverLabel ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-slate-900/88 px-2 py-1 text-xs text-white">
          {hoverLabel}
        </div>
      ) : null}
    </section>
  );
}
