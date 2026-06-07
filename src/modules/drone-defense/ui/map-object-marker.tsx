"use client";

import {
  ApiOutlined,
  ApartmentOutlined,
  BuildOutlined,
  ClusterOutlined,
  CompassOutlined,
  EyeOutlined,
  GlobalOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";
import type { EchelonMapPlacement } from "@/modules/drone-defense/domain/echelon-map-model";

export type MapMarkerState = "default" | "hover" | "selected" | "disabled" | "warning" | "conflict" | "inactive";

export const ASSET_CATEGORY_COLORS: Record<string, string> = {
  "early-warning": "#10b981",
  detection: "#2563eb",
  classification: "#38bdf8",
  jamming: "#f97316",
  spoofing: "#a855f7",
  kinetic: "#ef4444",
  interceptor: "#dc2626",
  "passive-protection": "#64748b",
  "engineering-protection": "#6b7280",
  infrastructure: "#14b8a6",
  software: "#8b5cf6",
  "command-center": "#059669",
  "external-service": "#0f766e",
};

const layerCategoryFallback: Record<string, string> = {
  layer_01_external_warning: "early-warning",
  layer_02_detection: "detection",
  layer_03_identification: "classification",
  layer_04_suppression: "jamming",
  layer_05_mid_range_kinetic: "kinetic",
  layer_06_last_line_kinetic: "interceptor",
  layer_07_accuracy_disruption: "passive-protection",
  layer_08_passive_protection: "passive-protection",
  layer_09_hardening: "engineering-protection",
};

export function getAssetCategoryColor(placement: EchelonMapPlacement) {
  const category = placement.markerCategory ?? layerCategoryFallback[placement.layerId] ?? "infrastructure";
  return ASSET_CATEGORY_COLORS[category] ?? ASSET_CATEGORY_COLORS.infrastructure;
}

export function getAssetMarkerIcon(placement: EchelonMapPlacement): ReactNode {
  const category = placement.markerCategory ?? layerCategoryFallback[placement.layerId] ?? "infrastructure";
  const label = placement.label.toLowerCase();
  if (label.includes("osint")) return <GlobalOutlined />;
  if (label.includes("комендат") || label.includes("штаб")) return <ApartmentOutlined />;
  if (label.includes("тепловиз")) return <EyeOutlined />;
  if (label.includes("опти") || label.includes("кам")) return <VideoCameraOutlined />;
  if (label.includes("рлс") || label.includes("радар")) return <RadarChartOutlined />;
  if (label.includes("рэб") || label.includes("подав") || label.includes("спуф")) return <ApiOutlined />;
  if (label.includes("турел") || label.includes("перехв")) return <CompassOutlined />;
  if (label.includes("сет") || label.includes("барьер") || label.includes("защит")) return <SafetyCertificateOutlined />;

  switch (category) {
    case "early-warning":
    case "command-center":
      return <ApartmentOutlined />;
    case "detection":
      return <RadarChartOutlined />;
    case "classification":
      return <EyeOutlined />;
    case "jamming":
    case "spoofing":
      return <ApiOutlined />;
    case "kinetic":
    case "interceptor":
      return <CompassOutlined />;
    case "passive-protection":
    case "engineering-protection":
      return <SafetyCertificateOutlined />;
    case "software":
    case "external-service":
      return <ClusterOutlined />;
    default:
      return <BuildOutlined />;
  }
}

export function getMarkerState(placement: EchelonMapPlacement, isHovered: boolean): MapMarkerState {
  if (placement.isSelected) return "selected";
  if (isHovered) return "hover";
  return "default";
}

export function shouldShowLabel({
  zoom,
  isSelected,
  isHovered,
}: {
  zoom: number;
  isSelected: boolean;
  isHovered: boolean;
}) {
  return isSelected || isHovered || zoom >= 10.5;
}

type MapObjectMarkerProps = {
  placement: EchelonMapPlacement;
  x: number;
  y: number;
  zoom: number;
  layerLabel?: string;
  isHovered: boolean;
  onSelect: (placement: EchelonMapPlacement) => void;
  onHover: (placement: EchelonMapPlacement | null) => void;
};

export function MapObjectMarker({
  placement,
  x,
  y,
  zoom,
  layerLabel,
  isHovered,
  onSelect,
  onHover,
}: MapObjectMarkerProps) {
  const state = getMarkerState(placement, isHovered);
  const categoryColor = getAssetCategoryColor(placement);
  const showLabel = shouldShowLabel({ zoom, isSelected: Boolean(placement.isSelected), isHovered });
  const markerSize = placement.isSelected ? 46 : isHovered ? 40 : 36;
  const markerBadge = placement.qty > 1 ? placement.qty : null;
  const markerStyle = {
    "--marker-color": categoryColor,
    left: x,
    top: y,
    width: markerSize,
    height: markerSize,
    transform: "translate(-50%, -50%)",
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`pointer-events-auto absolute z-20 grid place-items-center rounded-[11px] border-2 bg-slate-950/90 text-[17px] text-white shadow-lg shadow-slate-950/30 outline-none transition duration-150 hover:scale-[1.08] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
        placement.isSelected ? "ring-2 ring-white/90" : ""
      } border-[var(--marker-color)]`}
      style={markerStyle}
      aria-label={`${placement.label}, ${layerLabel ?? placement.layerId}, ${placement.qty} ед.`}
      title={`${placement.label}${layerLabel ? ` · ${layerLabel}` : ""}`}
      data-testid={`map-object-marker-${placement.sourcePlacementId}`}
      data-marker-state={state}
      data-marker-category={placement.markerCategory ?? layerCategoryFallback[placement.layerId] ?? "infrastructure"}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(placement);
      }}
      onMouseEnter={() => onHover(placement)}
      onMouseLeave={() => onHover(null)}
    >
      <span className="grid place-items-center" aria-hidden="true">
        {getAssetMarkerIcon(placement)}
      </span>
      <span
        className="absolute -bottom-0.5 -left-0.5 h-2 w-2 rounded-full border border-slate-950 bg-[var(--marker-color)]"
        aria-hidden="true"
      />
      {markerBadge ? (
        <span className="markerBadge absolute -right-1.5 -top-1.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-slate-950 px-1 text-[10px] font-black leading-none text-white ring-1 ring-white/80">
          {markerBadge}
        </span>
      ) : null}
      {showLabel ? (
        <span className="pointer-events-none absolute left-full top-1/2 ml-2 max-w-44 -translate-y-1/2 truncate rounded-full bg-slate-950/92 px-2.5 py-1 text-xs font-semibold text-white shadow-md shadow-slate-950/25">
          {placement.label}
        </span>
      ) : null}
    </button>
  );
}
