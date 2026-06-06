"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { IconLayer, PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Layer, WebMercatorViewport } from "@deck.gl/core";
import MaplibreMap from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import { defenseLayers, type EchelonCatalogGroup } from "@/modules/drone-defense/infra/mock-defense-data";
import {
  buildEchelonMapModel,
  buildLayerFocusViewState,
  type EchelonMapPlacement,
  type EchelonMapSlot,
  type EchelonZone,
  type LayerFocusViewState,
} from "@/modules/drone-defense/domain/echelon-map-model";
import {
  getBuildAssetForCatalogGroup,
  type BuildAssetIcon,
} from "@/modules/drone-defense/domain/echelon-build-assets";
import { withBasePath } from "@/shared/lib/base-path";
import type {
  Configuration,
  DefenseCatalogResponse,
  DefenseLayer,
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
  mapLayers: DefenseLayer[];
  previewLayer?: DefenseLayer | null;
  selectedLayerId: string;
  selectedSlotId: string | null;
  activeToolId: string | null;
  placementHint: string;
  onSelectLayer: (layerId: string) => void;
  onSelectSlot: (slot: EchelonMapSlot) => void;
  onSelectPlacement: (placementId: string) => void;
  onSelectTool: (groupId: string) => void;
  onPlaceActiveTool?: (coordinate: { lng: number; lat: number }) => void;
  onDropAsset?: (assetId: string, coordinate: { lng: number; lat: number }) => void;
  pointerDraggedAssetId?: string | null;
  onPointerDropAsset?: (assetId: string, coordinate: { lng: number; lat: number }) => void;
};

const defenseAssetDragMimeType = "application/x-fortis-defense-asset";

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
  group: EchelonCatalogGroup;
  asset: BuildAssetIcon;
  placement: EchelonMapPlacement | null;
};

type BuiltPlacementIcon = {
  placement: EchelonMapPlacement;
  asset: BuildAssetIcon;
};

type MapToolMarker = SlotBuildIcon & {
  x: number;
  y: number;
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
  mapLayers,
  previewLayer,
  selectedLayerId,
  selectedSlotId,
  activeToolId,
  placementHint,
  onSelectLayer,
  onSelectSlot,
  onSelectPlacement,
  onSelectTool,
  onPlaceActiveTool,
  onDropAsset,
  pointerDraggedAssetId,
  onPointerDropAsset,
}: GisBoardProps) {
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);
  const [viewState, setViewState] = useState<LayerFocusViewState>(fallbackViewState);
  const boardRef = useRef<HTMLElement | null>(null);
  const viewStateRef = useRef<LayerFocusViewState>(fallbackViewState);
  const animationFrameRef = useRef<number | null>(null);
  const isAnimatingFocusRef = useRef(false);

  const selectedFacility = facilities.find((item) => item.id === selectedFacilityId);
  const visibleFacilities = useMemo(() => (selectedFacility ? [selectedFacility] : []), [selectedFacility]);
  const layerCoverage = hexCoverageByLayer(layers);
  const visibleMapLayers = useMemo(
    () => (previewLayer ? [...mapLayers, previewLayer] : mapLayers),
    [mapLayers, previewLayer],
  );
  const selectedLayer = visibleMapLayers.find((layer) => layer.id === selectedLayerId) ?? visibleMapLayers[0] ?? defenseLayers[0];
  const echelonModel = useMemo(
    () =>
      buildEchelonMapModel({
        facility: selectedFacility ?? null,
        layers: visibleMapLayers,
        layerCoverage: layers,
        configuration,
        catalog,
        selectedLayerId: selectedLayerId as DefenseLayerId,
        selectedSlotId,
      }),
    [catalog, configuration, layers, visibleMapLayers, selectedFacility, selectedLayerId, selectedSlotId],
  );
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

  useEffect(() => {
    if (!pointerDraggedAssetId || !onPointerDropAsset) return;
    const dropDraggedAsset = (event: PointerEvent | MouseEvent | DragEvent) => {
      const boardElement = boardRef.current;
      if (!boardElement) return;
      const rect = boardElement.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      ) {
        return;
      }
      const viewport = new WebMercatorViewport({
        ...viewStateRef.current,
        width: rect.width,
        height: rect.height,
      });
      const [lng, lat] = viewport.unproject([event.clientX - rect.left, event.clientY - rect.top]);
      onPointerDropAsset(pointerDraggedAssetId, { lng, lat });
    };
    window.addEventListener("pointerup", dropDraggedAsset, true);
    window.addEventListener("mouseup", dropDraggedAsset, true);
    window.addEventListener("dragend", dropDraggedAsset, true);
    return () => {
      window.removeEventListener("pointerup", dropDraggedAsset, true);
      window.removeEventListener("mouseup", dropDraggedAsset, true);
      window.removeEventListener("dragend", dropDraggedAsset, true);
    };
  }, [onPointerDropAsset, pointerDraggedAssetId]);

  const zoomReadout = viewState.zoom;
  const iconPlacements = useMemo(
    () =>
      echelonModel.placements
        .filter((placement) => placement.layerId !== selectedLayerId)
        .map((placement) => ({
          placement,
          asset: placement.catalogGroupId ? getBuildAssetForCatalogGroup(placement.catalogGroupId) : null,
        }))
        .filter((item): item is BuiltPlacementIcon => Boolean(item.asset)),
    [echelonModel.placements, selectedLayerId],
  );

  const mapToolMarkers: MapToolMarker[] = [];

  const deckLayers = useMemo(
    () =>
      [
        ...echelonModel.zones.flatMap((zone) => {
          const layerSlug = zone.shortName.toLowerCase();
          const isActive = zone.layerId === selectedLayerId;
          const isPreview = previewLayer?.id === zone.layerId;
          const zoneLayer = visibleMapLayers.find((layer) => layer.id === zone.layerId);
          const isFilledDiskZone = (zoneLayer?.distanceBandM.min ?? 0) <= 0;
          const zoneFillColor = (item: EchelonZone) =>
            isPreview
              ? ([14, 165, 233, 54] as [number, number, number, number])
              : isActive
                ? ([item.fillColor[0], item.fillColor[1], item.fillColor[2], Math.max(item.fillColor[3], 132)] as [number, number, number, number])
                : ([item.fillColor[0], item.fillColor[1], item.fillColor[2], Math.max(18, Math.round(item.fillColor[3] * 0.45))] as [number, number, number, number]);
          const zoneLineColor = (item: EchelonZone) =>
            isPreview
              ? ([2, 132, 199, 245] as [number, number, number, number])
              : isActive
                ? ([15, 23, 42, 255] as [number, number, number, number])
                : ([item.lineColor[0], item.lineColor[1], item.lineColor[2], 90] as [number, number, number, number]);
          const handleZoneClick = (object: EchelonZone | null | undefined) => {
            if (!object) return;
            if (previewLayer?.id === object.layerId) return;
            onSelectLayer(object.layerId);
          };
          const handleZoneHover = (object: EchelonZone | null | undefined) =>
            setHoverLabel(
              object
                ? `${object.shortName}: ${object.name}, ${object.distanceLabel}`
                : null,
            );
          const handleSlotClick = (object: EchelonMapSlot | null | undefined) => {
            if (!object) return;

            onSelectSlot(object);
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
                  getLineWidth: () => (isPreview ? 3 : isActive ? 4 : 1.5),
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
                  getLineWidth: () => (isPreview ? 3 : isActive ? 4 : 1.5),
                  lineWidthUnits: "pixels",
                  onClick: ({ object }) => handleZoneClick(object),
                  onHover: ({ object }) => handleZoneHover(object),
                }),
            new ScatterplotLayer<EchelonMapSlot>({
              id: `echelon-${layerSlug}-slots`,
              data: [],
              getPosition: (item) => item.position,
              getRadius: (item) => (item.status === "selected" ? 2400 : item.status === "occupied" ? 2100 : 1600),
              radiusMinPixels: 8,
              radiusMaxPixels: 18,
              getFillColor: [255, 255, 255, 0],
              getLineColor: [255, 255, 255, 0],
              lineWidthMinPixels: 2,
              stroked: true,
              pickable: true,
              onClick: ({ object }) => handleSlotClick(object),
              onHover: () => setHoverLabel(null),
            }),
            new TextLayer<EchelonMapSlot>({
              id: `echelon-${layerSlug}-slot-labels`,
              data: [],
              getPosition: (item) => item.position,
              getText: (item) => item.label,
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
              onHover: () => setHoverLabel(null),
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
            url: withBasePath(item.asset.imageUrl),
            width: 128,
            height: 128,
            anchorY: 64,
          }),
          getSize: (item) => (item.placement.isSelected ? 58 : item.placement.layerId === selectedLayerId ? 50 : 36),
          sizeUnits: "pixels",
          billboard: true,
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
            onSelectPlacement(object.placement.sourcePlacementId);
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
          getRadius: (item) => (item.isSelected ? 2200 : item.layerId === selectedLayerId ? 1700 : 1150),
          radiusMinPixels: 5,
          radiusMaxPixels: 18,
          getFillColor: (item) => (item.catalogGroupId ? [255, 255, 255, 0] : item.isConflict ? [245, 158, 11, 235] : item.color),
          getLineColor: (item) =>
            item.isConflict
              ? [180, 83, 9, 255]
              : item.isSelected
                ? [37, 99, 235, 255]
                : item.layerId === selectedLayerId
                  ? [15, 23, 42, 255]
                  : [255, 255, 255, 220],
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
            onSelectPlacement(object.sourcePlacementId);
            onSelectLayer(object.layerId);
          },
          onHover: ({ object }) =>
            setHoverLabel(
              object
                ? `${object.label} · ${visibleMapLayers.find((layer) => layer.id === object.layerId)?.shortName}${object.isConflict ? " · конфликт" : ""}`
                : null,
            ),
        }),
        new TextLayer<EchelonMapPlacement>({
          id: "echelon-placement-labels",
          data: echelonModel.placements.filter((item) => item.layerId === selectedLayerId && !item.catalogGroupId),
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
      filteredHexes,
      filteredRoutes,
      iconPlacements,
      layerCoverage,
      onSelectFacility,
      onSelectLayer,
      onSelectPlacement,
      onSelectSlot,
      previewLayer,
      visibleMapLayers,
      selectedFacility?.center.lat,
      selectedFacility?.center.lon,
      selectedLayerId,
      visibleFacilities,
    ],
  );

  return (
    <section
      ref={boardRef}
      className={`relative h-[calc(100vh-11.5rem)] min-h-[540px] overflow-hidden rounded-lg border border-slate-200 ${className}`}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(defenseAssetDragMimeType)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(event) => {
        const assetId = event.dataTransfer.getData(defenseAssetDragMimeType);
        if (!assetId || !onDropAsset) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const viewport = new WebMercatorViewport({
          ...viewStateRef.current,
          width: rect.width,
          height: rect.height,
        });
        const [lng, lat] = viewport.unproject([event.clientX - rect.left, event.clientY - rect.top]);
        onDropAsset(assetId, { lng, lat });
      }}
    >
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
        onClick={(info) => {
          if (!activeToolId || !info.coordinate || !onPlaceActiveTool) return;
          onPlaceActiveTool({ lng: info.coordinate[0], lat: info.coordinate[1] });
        }}
      >
        <MaplibreMap mapStyle={mapStyle} />
      </DeckGL>

      <div className="pointer-events-none absolute inset-0 z-10">
        {mapToolMarkers.map((marker) => {
          const isBuilt = Boolean(marker.placement);
          const isSelected = activeToolId === marker.group.id || selectedSlotId === marker.slot.id;
          return (
            <button
              key={marker.slot.id}
              type="button"
              className={`pointer-events-auto absolute h-[58px] w-[58px] cursor-pointer overflow-visible rounded-xl border-2 bg-white/95 p-1 shadow-lg shadow-slate-950/20 backdrop-blur transition ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-400/45"
                  : isBuilt
                    ? "border-emerald-400"
                    : "border-white/90"
              }`}
              style={{
                left: marker.x,
                top: marker.y,
                transform: "translate(-50%, -72%)",
              }}
              title={`Позиция: ${marker.group.name} · ${isBuilt ? "установлено" : "не добавлено"}`}
              onClick={() => {
                onSelectSlot(marker.slot);
                onSelectTool(marker.group.id);
              }}
              onMouseEnter={() =>
                setHoverLabel(`Позиция: ${marker.group.name} · ${isBuilt ? "установлено" : "не добавлено"}`)
              }
              onMouseLeave={() => setHoverLabel(null)}
            >
              <span
                className={`block h-full w-full rounded-lg border bg-center bg-contain bg-no-repeat ${
                  isBuilt
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-100 grayscale"
                }`}
                style={{ backgroundImage: `url("${withBasePath(marker.asset.imageUrl)}")` }}
              />
              <span
                className={`absolute -right-2 -top-2 grid h-6 min-w-6 place-items-center rounded-full border-2 border-white px-1 text-[11px] font-bold shadow ${
                  isBuilt ? "bg-slate-950 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {marker.placement?.qty ?? 0}
              </span>
            </button>
          );
        })}
      </div>

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
            {placementHint}
          </p>
        </div>
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
