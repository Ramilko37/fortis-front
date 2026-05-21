"use client";

import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { PathLayer, PolygonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import { Layer } from "@deck.gl/core";
import MaplibreMap from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { StyleSpecification } from "maplibre-gl";
import { defenseLayers, type EchelonCatalogGroup } from "@/modules/drone-defense/infra/mock-defense-data";
import { buildEchelonMapModel, type EchelonMapPlacement, type EchelonZone } from "@/modules/drone-defense/domain/echelon-map-model";
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
  facilities: Facility[];
  selectedFacilityId: string;
  onSelectFacility: (facilityId: string) => void;
  hexCells: HexCell[];
  threatRoutes: ThreatRoute[];
  layers: DefenseLayersResponse | null;
  configuration: Configuration;
  catalog: DefenseCatalogResponse | null;
  selectedLayerId: DefenseLayerId;
  selectedLayerGroups: EchelonCatalogGroup[];
  onSelectLayer: (layerId: DefenseLayerId) => void;
  onAddCatalogGroup: (groupId: string) => void;
  onRemoveCatalogGroup: (groupId: string) => void;
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

export function GisBoard({
  facilities,
  selectedFacilityId,
  onSelectFacility,
  hexCells,
  threatRoutes,
  layers,
  configuration,
  catalog,
  selectedLayerId,
  selectedLayerGroups,
  onSelectLayer,
  onAddCatalogGroup,
  onRemoveCatalogGroup,
}: GisBoardProps) {
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  const selectedFacility = facilities.find((item) => item.id === selectedFacilityId);
  const layerCoverage = hexCoverageByLayer(layers);
  const selectedLayer = defenseLayers.find((layer) => layer.id === selectedLayerId) ?? defenseLayers[0];
  const selectedLayerCoverage = layers?.layerCoverage.find((item) => item.layerId === selectedLayerId)?.coveredPct ?? 0;
  const selectedLayerPlacements = configuration.placements.filter((placement) => placement.layerId === selectedLayerId);
  const layerOrderById = useMemo(() => new globalThis.Map(defenseLayers.map((layer) => [layer.id, layer.order])), []);
  const echelonModel = useMemo(
    () =>
      buildEchelonMapModel({
        facility: selectedFacility ?? null,
        layers: defenseLayers,
        layerCoverage: layers,
        configuration,
        catalog,
      }),
    [catalog, configuration, layers, selectedFacility],
  );

  const filteredHexes = useMemo(
    () => hexCells.filter((cell) => cell.facilityId === selectedFacilityId),
    [hexCells, selectedFacilityId],
  );
  const filteredRoutes = useMemo(
    () => threatRoutes.filter((route) => route.facilityId === selectedFacilityId),
    [threatRoutes, selectedFacilityId],
  );

  const deckLayers = useMemo(
    () =>
      [
        new PolygonLayer<EchelonZone>({
          id: "echelon-distance-zones",
          data: echelonModel.zones.toSorted((a, b) => {
            const aLayer = defenseLayers.find((layer) => layer.id === a.layerId);
            const bLayer = defenseLayers.find((layer) => layer.id === b.layerId);
            return (aLayer?.order ?? 0) - (bLayer?.order ?? 0);
          }),
          pickable: true,
          stroked: true,
          filled: true,
          extruded: false,
          getPolygon: (item) => item.polygon,
          getFillColor: (item) => {
            if (item.layerId === selectedLayerId) return [item.fillColor[0], item.fillColor[1], item.fillColor[2], 135];
            return item.fillColor;
          },
          getLineColor: (item) => {
            if (item.layerId === selectedLayerId) return [15, 23, 42, 255];
            return item.lineColor;
          },
          getLineWidth: (item) => (item.layerId === selectedLayerId ? 180 : 90),
          lineWidthUnits: "meters",
          onClick: ({ object }) => {
            if (!object) return;
            onSelectLayer(object.layerId);
          },
          onHover: ({ object }) =>
            setHoverLabel(
              object
                ? `${object.shortName}: ${object.name}, ${object.distanceLabel}, объектов ${object.placedCount}`
                : null,
            ),
        }),
        new ScatterplotLayer<EchelonZone>({
          id: "echelon-interaction-rings",
          data: echelonModel.zones,
          getPosition: () =>
            selectedFacility ? [selectedFacility.center.lon, selectedFacility.center.lat] : [60.5945, 56.8389],
          radiusUnits: "pixels",
          getRadius: (item) => 58 + (10 - (layerOrderById.get(item.layerId) ?? 1)) * 17,
          stroked: true,
          filled: false,
          lineWidthMinPixels: 2,
          getLineColor: (item) => {
            if (item.layerId === selectedLayerId) return [15, 23, 42, 255];
            return [item.lineColor[0], item.lineColor[1], item.lineColor[2], 190];
          },
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
            onSelectLayer(object.layerId);
          },
          onHover: ({ object }) =>
            setHoverLabel(
              object
                ? `${object.shortName}: интерактивный слой размещения, ${object.distanceLabel}`
                : null,
            ),
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
        new ScatterplotLayer<EchelonMapPlacement>({
          id: "echelon-placement-objects",
          data: echelonModel.placements,
          getPosition: (item) => item.position,
          getRadius: (item) => (item.layerId === selectedLayerId ? 1700 : 1150),
          radiusMinPixels: 5,
          radiusMaxPixels: 14,
          getFillColor: (item) => item.color,
          getLineColor: (item) => (item.layerId === selectedLayerId ? [15, 23, 42, 255] : [255, 255, 255, 220]),
          lineWidthMinPixels: 1,
          stroked: true,
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
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
        new TextLayer<EchelonZone>({
          id: "echelon-zone-labels",
          data: echelonModel.zones,
          getPosition: (item) => item.polygon[0]?.[Math.floor(item.polygon[0].length / 8)] ?? [0, 0],
          getText: (item) => `${item.shortName} · ${item.distanceLabel}`,
          getColor: (item) => (item.layerId === selectedLayerId ? [15, 23, 42, 255] : item.lineColor),
          getSize: (item) => (item.layerId === selectedLayerId ? 14 : 11),
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
          background: true,
          getBackgroundColor: [255, 255, 255, 205],
          backgroundPadding: [4, 2],
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
            onSelectLayer(object.layerId);
          },
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
          data: facilities,
          getPosition: (item) => [item.center.lon, item.center.lat],
          getRadius: (item) => (item.id === selectedFacilityId ? 9000 : 6200),
          radiusMinPixels: 6,
          radiusMaxPixels: 20,
          getFillColor: (item) => (item.id === selectedFacilityId ? [0, 174, 255, 255] : [24, 199, 120, 210]),
          pickable: true,
          onClick: ({ object }) => {
            if (!object) return;
            onSelectFacility(object.id);
          },
          onHover: ({ object }) => setHoverLabel(object ? object.name : null),
        }),
        new TextLayer<Facility>({
          id: "facility-labels",
          data: facilities,
          getPosition: (item) => [item.center.lon, item.center.lat],
          getText: (item) => item.name,
          getColor: [30, 41, 59, 255],
          getSize: 12,
          getTextAnchor: "start",
          getAlignmentBaseline: "bottom",
          getPixelOffset: [12, -12],
        }),
      ] satisfies Layer[],
    [echelonModel, facilities, filteredHexes, filteredRoutes, layerCoverage, layerOrderById, onSelectFacility, onSelectLayer, selectedFacility, selectedFacilityId, selectedLayerId],
  );

  return (
    <section className="relative h-[calc(100vh-11.5rem)] min-h-[540px] overflow-hidden rounded-lg border border-slate-200">
      <DeckGL
        initialViewState={{
          longitude: selectedFacility?.center.lon ?? 60.5945,
          latitude: selectedFacility?.center.lat ?? 56.8389,
          zoom: 7.2,
          pitch: 28,
          bearing: 0,
        }}
        controller
        layers={deckLayers}
      >
        <MaplibreMap mapStyle={mapStyle} />
      </DeckGL>

      <aside className="absolute left-3 top-3 w-[320px] rounded-md border border-slate-200 bg-white/92 p-3 text-xs shadow-sm backdrop-blur">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">GIS Board</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{selectedFacility?.name ?? "Facility"}</p>
        <p className="mt-1 text-slate-600">{selectedFacility?.region ?? "—"}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded bg-slate-100 px-2 py-1.5">
            <p className="text-[10px] uppercase text-slate-500">Hex cells</p>
            <p className="text-sm font-semibold text-slate-900">{filteredHexes.length}</p>
          </div>
          <div className="rounded bg-slate-100 px-2 py-1.5">
            <p className="text-[10px] uppercase text-slate-500">Threat routes</p>
            <p className="text-sm font-semibold text-slate-900">{filteredRoutes.length}</p>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[10px] uppercase text-slate-500">Layer Readiness L1-L9</p>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {defenseLayers.map((layer) => {
              const layerItem = layers?.layerCoverage.find((item) => item.layerId === layer.id);
              const coverage = layerItem?.coveredPct ?? 0;
              const distanceBand = layerItem?.distanceBandM?.label ?? layer.distanceBandM.label;
              return (
                <button
                  key={layer.id}
                  type="button"
                  className={`rounded px-1.5 py-1 text-left text-[10px] font-semibold transition ${
                    selectedLayerId === layer.id ? "ring-2 ring-sky-500" : ""
                  } ${readinessClassName(coverage)}`}
                  onClick={() => onSelectLayer(layer.id)}
                  title={`${layer.name}: ${readinessLabel(coverage)} (${Math.round(coverage * 100)}%)`}
                >
                  <span className="block">{layer.shortName} {Math.round(coverage * 100)}%</span>
                  <span className="block text-[9px] font-medium opacity-75">{distanceBand}</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <aside className="absolute bottom-3 right-3 max-h-[calc(100%-1.5rem)] w-[360px] overflow-auto rounded-md border border-slate-200 bg-white/94 p-3 text-xs shadow-sm backdrop-blur">
        <p className="text-[11px] font-semibold uppercase text-slate-500">Active Echelon Placement</p>
        <div className="mt-1 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {selectedLayer.shortName} · {selectedLayer.name}
            </p>
            <p className="mt-0.5 text-slate-600">{selectedLayer.distanceBandM.label} от объекта</p>
          </div>
          <span className={readinessClassName(selectedLayerCoverage) + " rounded px-2 py-1 font-semibold"}>
            {Math.round(selectedLayerCoverage * 100)}%
          </span>
        </div>

        <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-2">
          <p className="font-semibold text-slate-800">Размещено на эшелоне: {selectedLayerPlacements.length}</p>
          <p className="mt-1 text-slate-600">
            Клик по цветному кольцу выбирает эшелон. Добавление ниже создаёт объект на этом цветном слое и пересчитывает KPI.
          </p>
        </div>

        <div className="mt-3 space-y-2">
          {selectedLayerGroups.map((group) => {
            const placement = configuration.placements.find((item) => item.catalogGroupId === group.id);
            const isPlaced = Boolean(placement);
            return (
              <div key={group.id} className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white p-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{group.name}</p>
                  <p className="text-[10px] text-slate-500">Вес {group.weightPct}% · {selectedLayer.shortName}</p>
                </div>
                <button
                  type="button"
                  className={`h-8 shrink-0 rounded px-2 text-[11px] font-semibold ${
                    isPlaced ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"
                  }`}
                  onClick={() => (isPlaced ? onRemoveCatalogGroup(group.id) : onAddCatalogGroup(group.id))}
                >
                  {isPlaced ? "Убрать" : "Поставить"}
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {hoverLabel ? (
        <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-slate-900/88 px-2 py-1 text-xs text-white">
          {hoverLabel}
        </div>
      ) : null}
    </section>
  );
}
