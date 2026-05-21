"use client";

import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Grid, Html, Line, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ScaledGlbModel } from "@/components/FactoryMap/ScaledGlbModel";
import { isAssetType, type AssetType } from "@/config/assetDimensions";
import { withBasePath } from "@/shared/lib/base-path";
import {
  plantSite,
  plantZones,
  type PlantMapConnection,
  type PlantMapObject,
} from "./plant-map";
import {
  criticalTargets,
  defenseRoleColor,
  kindColor,
  snapToGrid,
  threatStatusColor,
  threatStatusLabel,
  threatTracks,
  type CameraPresetId,
  type ObjectKind,
  type ScenarioId,
  type SceneObject,
  type ThreatStatus,
} from "../domain/prototype-types";
import styles from "./drone-defense-prototype.module.css";

const levelPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const PLANT_SCALE = 1;
const SQRT3 = Math.sqrt(3);
const HEX_SIZE_M = 18;
type CameraPresetRequest = {
  id: CameraPresetId;
  nonce: number;
};

type ViewMode = "scene3d" | "hex";

type SnappedPosition = {
  x: number;
  z: number;
};

function axialToWorld(q: number, r: number, size: number): SnappedPosition {
  return {
    x: size * SQRT3 * (q + r / 2),
    z: size * 1.5 * r,
  };
}

function worldToAxial(x: number, z: number, size: number): SnappedPosition {
  return {
    x: (SQRT3 / 3 * x - 1 / 3 * z) / size,
    z: (2 / 3 * z) / size,
  };
}

function roundAxial(q: number, r: number): SnappedPosition {
  const x = q;
  const z = r;
  const y = -x - z;
  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, z: rz };
}

function snapToHexCenter(x: number, z: number, size: number): SnappedPosition {
  const axial = worldToAxial(x, z, size);
  const rounded = roundAxial(axial.x, axial.z);
  return axialToWorld(rounded.x, rounded.z, size);
}

function distanceToThreatPath(
  pointX: number,
  pointZ: number,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number {
  const abX = toX - fromX;
  const abZ = toZ - fromZ;
  const apX = pointX - fromX;
  const apZ = pointZ - fromZ;
  const abSq = abX * abX + abZ * abZ;
  if (abSq <= Number.EPSILON) return Math.hypot(apX, apZ);
  const t = Math.max(0, Math.min(1, (apX * abX + apZ * abZ) / abSq));
  const closestX = fromX + abX * t;
  const closestZ = fromZ + abZ * t;
  return Math.hypot(pointX - closestX, pointZ - closestZ);
}
const scaledAssetByModelKey: Record<
  string,
  {
    url: string;
    assetType: AssetType;
    upAxis?: "Y" | "Z";
    scaleMode?: "exact" | "uniformByHeight";
    modelRotation?: [number, number, number];
  }
> = {
  protected_column: {
    url: withBasePath("/models/kolonnyy-apparat-s-zashchitoy.glb"),
    assetType: "protected_column_apparatus",
    upAxis: "Z",
    scaleMode: "uniformByHeight",
  },
  operator_station_protected: {
    url: withBasePath("/models/protective/operator_substation_protected.glb"),
    assetType: "operator_substation_protected",
    upAxis: "Z",
  },
  scaffold_protection: {
    url: withBasePath("/models/protection/05_protective_scaffolding_with_equipment_textured.glb"),
    assetType: "protective_scaffolding_with_equipment",
    upAxis: "Z",
    scaleMode: "uniformByHeight",
  },
  fbs_barrier_segment: {
    url: withBasePath("/models/protection/04_perimeter_fbs_cable_barrier_textured.glb"),
    assetType: "perimeter_fbs_cable_barrier_module",
    upAxis: "Z",
  },
  mesh_screen: {
    url: withBasePath("/models/protection/02_cable_mesh_curtain_textured.glb"),
    assetType: "cable_mesh_curtain_module",
    upAxis: "Z",
  },
  tank_protected: {
    url: withBasePath("/models/protection/03_fbs_protection_enclosure_textured.glb"),
    assetType: "fbs_protection_enclosure",
    upAxis: "Z",
  },
};

const scaledAssetByKind: Record<
  SceneObject["kind"],
  {
    url: string;
    assetType: AssetType;
    upAxis?: "Y" | "Z";
    scaleMode?: "exact" | "uniformByHeight";
    modelRotation?: [number, number, number];
  }
> = {
  operator_substation: {
    url: withBasePath("/models/protective/operator_substation_protected.glb"),
    assetType: "operator_substation_protected",
    upAxis: "Z",
  },
  scaffolding: {
    url: withBasePath("/models/protection/05_protective_scaffolding_with_equipment_textured.glb"),
    assetType: "protective_scaffolding_with_equipment",
    upAxis: "Z",
    scaleMode: "uniformByHeight",
  },
  fbs_enclosure: {
    url: withBasePath("/models/protection/03_fbs_protection_enclosure_textured.glb"),
    assetType: "fbs_protection_enclosure",
    upAxis: "Z",
  },
  perimeter_barrier: {
    url: withBasePath("/models/protection/04_perimeter_fbs_cable_barrier_textured.glb"),
    assetType: "perimeter_fbs_cable_barrier_module",
    upAxis: "Z",
  },
  cable_mesh: {
    url: withBasePath("/models/protection/02_cable_mesh_curtain_textured.glb"),
    assetType: "cable_mesh_curtain_module",
    upAxis: "Z",
  },
  sensor: {
    url: withBasePath("/models/protective/operator_substation_protected.glb"),
    assetType: "operator_substation_protected",
  },
  camera: {
    url: withBasePath("/models/protection/02_cable_mesh_curtain_textured.glb"),
    assetType: "cable_mesh_curtain_module",
  },
  shield: {
    url: withBasePath("/models/protection/03_fbs_protection_enclosure_textured.glb"),
    assetType: "fbs_protection_enclosure",
  },
  post: {
    url: withBasePath("/models/protection/04_perimeter_fbs_cable_barrier_textured.glb"),
    assetType: "perimeter_fbs_cable_barrier_module",
  },
  barrier: {
    url: withBasePath("/models/protection/04_perimeter_fbs_cable_barrier_textured.glb"),
    assetType: "perimeter_fbs_cable_barrier_module",
  },
};

function zoneShape(points: [number, number][]) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    if (index === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });
  shape.closePath();
  return shape;
}

function dimensionsFor(item: PlantMapObject) {
  const dims = item.dimensions;
  const width = dims.width ?? dims.length ?? dims.protectedWidth ?? dims.diameter ?? 12;
  const depth = dims.depth ?? dims.protectedDepth ?? dims.width ?? dims.diameter ?? 12;
  const height = dims.height ?? Math.max(4, (dims.diameter ?? 10) * 0.7);
  const length = dims.length ?? dims.width ?? dims.depth ?? 20;
  const diameter = dims.diameter ?? Math.min(width, depth);
  return { width, depth, height, length, diameter };
}

function FenceFromPerimeter() {
  const [a, b, c, d] = plantSite.perimeterPoints;
  const fenceHeight = plantSite.fenceHeight;
  const segments = [
    { pos: [(a[0] + b[0]) / 2, 0, a[1]], size: [Math.abs(b[0] - a[0]), fenceHeight, 0.35] as [number, number, number] },
    { pos: [(d[0] + c[0]) / 2, 0, d[1]], size: [Math.abs(c[0] - d[0]), fenceHeight, 0.35] as [number, number, number] },
    { pos: [a[0], 0, (a[1] + d[1]) / 2], size: [0.35, fenceHeight, Math.abs(d[1] - a[1])] as [number, number, number] },
    { pos: [b[0], 0, (b[1] + c[1]) / 2], size: [0.35, fenceHeight, Math.abs(c[1] - b[1])] as [number, number, number] },
  ];

  return (
    <group>
      {segments.map((segment, index) => (
        <mesh key={index} position={[segment.pos[0], fenceHeight / 2, segment.pos[2]]}>
          <boxGeometry args={segment.size} />
          <meshStandardMaterial color="#8793a2" metalness={0.18} roughness={0.58} />
        </mesh>
      ))}
    </group>
  );
}

function BuildingBlock({ width, depth, height, color }: { width: number; depth: number; height: number; color: string }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.72} metalness={0.12} />
      </mesh>
      <mesh position={[0, height + 0.18, 0]}>
        <boxGeometry args={[width * 1.04, 0.32, depth * 1.03]} />
        <meshStandardMaterial color="#c0c8d4" roughness={0.86} metalness={0.04} />
      </mesh>
    </group>
  );
}

function RailUnit({ length }: { length: number }) {
  const sleeperCount = Math.max(10, Math.floor(length / 3.4));
  return (
    <group>
      <mesh position={[0, 0.16, -1]}>
        <boxGeometry args={[length, 0.1, 0.12]} />
        <meshStandardMaterial color="#6a7382" metalness={0.45} roughness={0.42} />
      </mesh>
      <mesh position={[0, 0.16, 1]}>
        <boxGeometry args={[length, 0.1, 0.12]} />
        <meshStandardMaterial color="#6a7382" metalness={0.45} roughness={0.42} />
      </mesh>
      {Array.from({ length: sleeperCount }).map((_, idx) => {
        const x = -length / 2 + (idx / Math.max(1, sleeperCount - 1)) * length;
        return (
          <mesh key={idx} position={[x, 0.08, 0]}>
            <boxGeometry args={[0.28, 0.08, 2.6]} />
            <meshStandardMaterial color="#8f8a82" roughness={0.86} />
          </mesh>
        );
      })}
    </group>
  );
}

function PipeRackUnit({ length, width, height }: { length: number; width: number; height: number }) {
  const postCount = Math.max(3, Math.floor(length / 16));
  return (
    <group>
      <mesh position={[0, height, 0]}>
        <boxGeometry args={[length, 0.3, width]} />
        <meshStandardMaterial color="#8792a3" metalness={0.24} roughness={0.52} />
      </mesh>
      {Array.from({ length: postCount }).map((_, idx) => {
        const x = -length / 2 + (idx / Math.max(1, postCount - 1)) * length;
        return (
          <group key={idx} position={[x, 0, 0]}>
            <mesh position={[0, height / 2, -width / 2 + 0.45]}>
              <boxGeometry args={[0.45, height, 0.45]} />
              <meshStandardMaterial color="#758194" metalness={0.2} roughness={0.56} />
            </mesh>
            <mesh position={[0, height / 2, width / 2 - 0.45]}>
              <boxGeometry args={[0.45, height, 0.45]} />
              <meshStandardMaterial color="#758194" metalness={0.2} roughness={0.56} />
            </mesh>
          </group>
        );
      })}
      {[-1.2, 0, 1.2].map((zOffset) => (
        <mesh key={zOffset} position={[0, height + 0.45, zOffset]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, length, 12]} />
          <meshStandardMaterial color="#666f7d" metalness={0.36} roughness={0.46} />
        </mesh>
      ))}
    </group>
  );
}

function PlantObjectMesh({ item }: { item: PlantMapObject }) {
  if (item.modelUrl && item.assetType && isAssetType(item.assetType)) {
    const target = dimensionsFor(item);
    const useTargetDimensions =
      item.assetType !== "perimeter_fbs_cable_barrier_module" &&
      item.assetType !== "cable_mesh_curtain_module";
    return (
      <Suspense fallback={null}>
        <ScaledGlbModel
          url={item.modelUrl}
          assetType={item.assetType}
          upAxis={item.upAxis}
          targetDimensions={
            useTargetDimensions ? { width: target.width, depth: target.depth, height: target.height } : undefined
          }
          rotation={[0, 0, 0]}
          scaleMode={item.scaleMode ?? "exact"}
          modelRotation={item.modelRotation ?? [0, 0, 0]}
        />
      </Suspense>
    );
  }

  const scaledConfig = scaledAssetByModelKey[item.modelKey];
  if (scaledConfig) {
    return (
      <Suspense fallback={null}>
        <ScaledGlbModel
          url={scaledConfig.url}
          assetType={scaledConfig.assetType}
          upAxis={scaledConfig.upAxis}
          rotation={[0, 0, 0]}
          scaleMode={scaledConfig.scaleMode ?? "exact"}
          modelRotation={scaledConfig.modelRotation ?? [0, 0, 0]}
        />
      </Suspense>
    );
  }

  const { width, depth, height, length, diameter } = dimensionsFor(item);

  if (item.type === "road") {
    return (
      <mesh receiveShadow position={[0, 0.06, 0]}>
        <boxGeometry args={[width, 0.06, depth]} />
        <meshStandardMaterial color="#a7b1bf" roughness={0.95} />
      </mesh>
    );
  }

  if (item.type === "railway") {
    return <RailUnit length={length} />;
  }

  if (item.type === "parking_area") {
    return (
      <mesh receiveShadow position={[0, 0.045, 0]}>
        <boxGeometry args={[width, 0.03, depth]} />
        <meshStandardMaterial color="#bbc3cf" roughness={0.95} />
      </mesh>
    );
  }

  if (item.type === "canopy") {
    return (
      <group>
        <mesh castShadow position={[0, height - 0.25, 0]}>
          <boxGeometry args={[width, 0.5, depth]} />
          <meshStandardMaterial color="#8f99a7" metalness={0.12} roughness={0.7} />
        </mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => [x, z] as const)).map(([sx, sz], idx) => (
          <mesh key={idx} castShadow position={[sx * (width / 2 - 0.8), height / 2 - 0.2, sz * (depth / 2 - 0.8)]}>
            <boxGeometry args={[0.45, height - 0.4, 0.45]} />
            <meshStandardMaterial color="#7d8794" metalness={0.18} roughness={0.62} />
          </mesh>
        ))}
      </group>
    );
  }

  if (item.type === "auto_overpass") {
    const rampLength = Math.max(18, length * 0.28);
    const deckLength = Math.max(28, length - rampLength * 2);
    return (
      <group>
        <mesh castShadow position={[0, height, 0]}>
          <boxGeometry args={[deckLength, 0.7, width]} />
          <meshStandardMaterial color="#9099a6" roughness={0.86} metalness={0.08} />
        </mesh>
        <mesh castShadow position={[-deckLength / 2 - rampLength / 2, height / 2, 0]} rotation={[0, 0, -0.22]}>
          <boxGeometry args={[rampLength, 0.65, width]} />
          <meshStandardMaterial color="#9aa2ae" roughness={0.88} />
        </mesh>
        <mesh castShadow position={[deckLength / 2 + rampLength / 2, height / 2, 0]} rotation={[0, 0, 0.22]}>
          <boxGeometry args={[rampLength, 0.65, width]} />
          <meshStandardMaterial color="#9aa2ae" roughness={0.88} />
        </mesh>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => [x, z] as const)).map(([sx, sz], idx) => (
          <mesh key={idx} castShadow position={[sx * (deckLength * 0.35), height / 2 - 0.2, sz * (width / 2 - 0.8)]}>
            <boxGeometry args={[0.65, height - 0.4, 0.65]} />
            <meshStandardMaterial color="#76808d" roughness={0.74} />
          </mesh>
        ))}
      </group>
    );
  }

  if (item.type === "tank" || item.type === "tank_protected") {
    const radius = diameter / 2;
    return (
      <group>
        <mesh castShadow position={[0, height / 2, 0]}>
          <cylinderGeometry args={[radius, radius * 1.02, height, 18]} />
          <meshStandardMaterial color="#9aa3b1" metalness={0.2} roughness={0.56} />
        </mesh>
        <mesh position={[0, height + 0.2, 0]}>
          <cylinderGeometry args={[radius * 1.03, radius * 1.03, 0.3, 18]} />
          <meshStandardMaterial color="#c4ccd8" />
        </mesh>
        {item.type === "tank_protected" ? (
          <mesh position={[0, height / 2, 0]}>
            <boxGeometry args={[width, height + 1.2, depth]} />
            <meshStandardMaterial color="#66707f" transparent opacity={0.11} />
          </mesh>
        ) : null}
      </group>
    );
  }

  if (item.type === "protected_column") {
    return (
      <group>
        <mesh castShadow position={[0, height / 2, 0]}>
          <cylinderGeometry args={[diameter * 0.25, diameter * 0.32, height, 14]} />
          <meshStandardMaterial color="#8f99a8" metalness={0.25} roughness={0.55} />
        </mesh>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height + 0.8, depth]} />
          <meshStandardMaterial color="#636d7a" transparent opacity={0.1} />
        </mesh>
      </group>
    );
  }

  if (item.type === "protected_column_group") {
    return (
      <group>
        {[-1, 1].flatMap((x) => [-1, 1].map((z) => [x, z] as const)).map(([gx, gz], idx) => (
          <mesh key={idx} castShadow position={[gx * width * 0.22, height * 0.45, gz * depth * 0.2]}>
            <cylinderGeometry args={[2.2, 2.5, height * 0.9, 12]} />
            <meshStandardMaterial color="#8f9aa9" metalness={0.2} roughness={0.56} />
          </mesh>
        ))}
        <mesh position={[0, height * 0.45, 0]}>
          <boxGeometry args={[width, height * 0.92, depth]} />
          <meshStandardMaterial color="#616a77" transparent opacity={0.1} />
        </mesh>
      </group>
    );
  }

  if (item.type === "reactor_unit") {
    return (
      <group>
        <mesh castShadow position={[0, height * 0.45, 0]}>
          <cylinderGeometry args={[width * 0.22, width * 0.26, height * 0.9, 14]} />
          <meshStandardMaterial color="#909aa8" metalness={0.25} roughness={0.55} />
        </mesh>
        <mesh castShadow position={[-width * 0.28, height * 0.35, 0]}>
          <boxGeometry args={[width * 0.26, height * 0.7, depth * 0.4]} />
          <meshStandardMaterial color="#a4aebb" />
        </mesh>
        <mesh castShadow position={[width * 0.28, height * 0.32, 0]}>
          <boxGeometry args={[width * 0.26, height * 0.64, depth * 0.4]} />
          <meshStandardMaterial color="#a4aebb" />
        </mesh>
      </group>
    );
  }

  if (item.type === "pipe_rack") {
    return <PipeRackUnit length={length} width={width} height={height} />;
  }

  if (item.type === "mesh_screen") {
    const postCount = Math.max(3, Math.floor(width / 8));
    return (
      <group>
        <mesh position={[0, height / 2, 0]}>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial color="#6f7887" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
        {Array.from({ length: postCount }).map((_, idx) => {
          const x = -width / 2 + (idx / Math.max(1, postCount - 1)) * width;
          return (
            <mesh key={idx} position={[x, height / 2, 0]}>
              <boxGeometry args={[0.35, height, 0.35]} />
              <meshStandardMaterial color="#7d8796" />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (item.type === "fbs_barrier") {
    const blockLength = 2.4;
    const count = Math.max(2, Math.floor(length / blockLength));
    return (
      <group>
        {Array.from({ length: count }).map((_, idx) => {
          const x = -length / 2 + blockLength * 0.5 + idx * blockLength;
          return (
            <mesh key={idx} position={[x, height * 0.5, 0]}>
              <boxGeometry args={[blockLength - 0.1, height, 1.8]} />
              <meshStandardMaterial color="#acb4c0" roughness={0.86} />
            </mesh>
          );
        })}
      </group>
    );
  }

  if (item.type === "scaffold_protection") {
    return (
      <group>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial color="#777f8c" transparent opacity={0.14} />
        </mesh>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width * 0.82, height * 0.7, depth * 0.82]} />
          <meshStandardMaterial color="#9ea8b5" />
        </mesh>
      </group>
    );
  }

  if (
    item.type === "checkpoint" ||
    item.type === "building" ||
    item.type === "operator_station" ||
    item.type === "pump_station" ||
    item.type === "compressor_station" ||
    item.type === "electrical_substation" ||
    item.type === "water_treatment" ||
    item.type === "warehouse" ||
    item.type === "loading_station"
  ) {
    return <BuildingBlock width={width} depth={depth} height={height} color="#9ca6b3" />;
  }

  return (
    <mesh castShadow position={[0, height / 2, 0]}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color="#9ca6b3" />
    </mesh>
  );
}

function PlantObjectUnit({
  item,
  onSelect,
}: {
  item: PlantMapObject;
  onSelect: () => void;
}) {
  return (
    <group
      position={item.position}
      rotation={item.rotation}
      scale={item.scale}
      onPointerOver={() => {
        if (item.selectable) document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
      onClick={(event) => {
        if (!item.selectable) return;
        event.stopPropagation();
        onSelect();
      }}
    >
      <PlantObjectMesh item={item} />
    </group>
  );
}

function PipelineConnection({ item }: { item: PlantMapConnection }) {
  const path = useMemo(
    () => item.points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    [item.points],
  );
  const curve = useMemo(() => new THREE.CatmullRomCurve3(path), [path]);
  const radius = item.diameter ? Math.max(0.08, item.diameter * 0.5) : 0.12;
  return (
    <mesh>
      <tubeGeometry args={[curve, 64, radius, 12, false]} />
      <meshStandardMaterial color="#6c7480" metalness={0.42} roughness={0.48} />
    </mesh>
  );
}

function RouteConnection({ item, color }: { item: PlantMapConnection; color: string }) {
  return (
    <Line
      points={item.points}
      color={color}
      lineWidth={2}
      dashed={item.type !== "route"}
      dashScale={3}
      dashSize={0.6}
      gapSize={0.45}
      transparent
      opacity={0.7}
    />
  );
}

function RiskHeatmap({ scenario }: { scenario: ScenarioId }) {
  const heatmapStyle = {
    baseline: { color: "#f6c65b", radius: 64, opacity: 0.12 },
    balanced: { color: "#67e8a6", radius: 54, opacity: 0.11 },
    reinforced: { color: "#55e7bb", radius: 46, opacity: 0.1 },
  }[scenario];

  return (
    <group>
      {criticalTargets.map((target) => (
        <mesh
          key={target.id}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[target.position[0], 0.025, target.position[2]]}
        >
          <circleGeometry args={[heatmapStyle.radius * target.riskWeight, 72]} />
          <meshBasicMaterial
            color={heatmapStyle.color}
            transparent
            opacity={heatmapStyle.opacity * target.riskWeight}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

type HexCell = {
  id: string;
  center: [number, number, number];
  color: THREE.Color;
};

function HexGridOverlay({
  mapHalfX,
  mapHalfZ,
  objects,
  scenario,
}: {
  mapHalfX: number;
  mapHalfZ: number;
  objects: SceneObject[];
  scenario: ScenarioId;
}) {
  const fillRef = useRef<THREE.InstancedMesh | null>(null);
  const borderRef = useRef<THREE.InstancedMesh | null>(null);
  const fillGeometry = useMemo(() => new THREE.CylinderGeometry(HEX_SIZE_M * 0.94, HEX_SIZE_M * 0.94, 0.04, 6), []);
  const borderGeometry = useMemo(() => new THREE.CylinderGeometry(HEX_SIZE_M * 0.98, HEX_SIZE_M * 0.98, 0.012, 6), []);
  const fillMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.42, depthWrite: false, vertexColors: true }),
    [],
  );
  const borderMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#d9ecff", transparent: true, opacity: 0.18, depthWrite: false }),
    [],
  );
  const cells = useMemo<HexCell[]>(() => {
    const maxR = Math.ceil(mapHalfZ / (HEX_SIZE_M * 1.5)) + 2;
    const maxQ = Math.ceil(mapHalfX / (HEX_SIZE_M * SQRT3)) + 2;
    const rows: HexCell[] = [];
    const highRiskColor = new THREE.Color("#ff5e4a");
    const warnColor = new THREE.Color("#f6c65b");
    const safeColor = new THREE.Color("#55e7bb");
    const coolColor = new THREE.Color("#55b5ff");
    const tintColor = new THREE.Color("#ff9d63");

    for (let r = -maxR; r <= maxR; r += 1) {
      for (let q = -maxQ; q <= maxQ; q += 1) {
        const world = axialToWorld(q, r, HEX_SIZE_M);
        if (Math.abs(world.x) > mapHalfX * 0.97 || Math.abs(world.z) > mapHalfZ * 0.97) continue;

        const weightedRisk = criticalTargets.reduce((sum, target) => {
          const distance = Math.hypot(world.x - target.position[0], world.z - target.position[2]);
          const localRisk = target.riskWeight * Math.exp(-distance / 170);
          return sum + localRisk;
        }, 0);

        const riskLevel = Math.max(0, Math.min(1, weightedRisk / 2.4));
        const covered = objects.some((object) => {
          const distance = Math.hypot(world.x - object.position[0], world.z - object.position[2]);
          return distance <= object.coverageRadiusM;
        });
        const onThreatPath = threatTracks.some((track) =>
          distanceToThreatPath(world.x, world.z, track.from[0], track.from[2], track.to[0], track.to[2]) < HEX_SIZE_M * 0.72,
        );

        const color = new THREE.Color();
        if (scenario === "baseline") {
          color.copy(covered ? safeColor : warnColor).lerp(highRiskColor, covered ? riskLevel * 0.32 : riskLevel);
        } else if (scenario === "balanced") {
          color.copy(covered ? coolColor : safeColor).lerp(highRiskColor, covered ? riskLevel * 0.24 : riskLevel * 0.62);
        } else {
          color.copy(covered ? coolColor : safeColor).lerp(highRiskColor, covered ? riskLevel * 0.2 : riskLevel * 0.52);
        }

        if (onThreatPath) {
          color.lerp(tintColor, 0.16);
        }

        const opacityBoost = covered ? 0.2 : riskLevel * 0.18;
        color.lerp(new THREE.Color("#ffffff"), opacityBoost);

        rows.push({
          id: `${q}:${r}`,
          center: [world.x, 0.03, world.z],
          color,
        });
      }
    }
    return rows;
  }, [mapHalfX, mapHalfZ, objects, scenario]);

  useLayoutEffect(() => {
    if (!fillRef.current || !borderRef.current) return;
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 6, 0));
    const scale = new THREE.Vector3(1, 1, 1);

    cells.forEach((cell, index) => {
      matrix.compose(new THREE.Vector3(...cell.center), rotation, scale);
      fillRef.current?.setMatrixAt(index, matrix);
      fillRef.current?.setColorAt(index, cell.color);
      borderRef.current?.setMatrixAt(index, matrix);
    });

    fillRef.current.instanceMatrix.needsUpdate = true;
    if (fillRef.current.instanceColor) fillRef.current.instanceColor.needsUpdate = true;
    borderRef.current.instanceMatrix.needsUpdate = true;
  }, [cells]);

  useEffect(() => () => {
    fillGeometry.dispose();
    borderGeometry.dispose();
    fillMaterial.dispose();
    borderMaterial.dispose();
  }, [borderGeometry, borderMaterial, fillGeometry, fillMaterial]);

  return (
    <group>
      <instancedMesh ref={fillRef} args={[fillGeometry, fillMaterial, cells.length]} />
      <instancedMesh ref={borderRef} args={[borderGeometry, borderMaterial, cells.length]} position={[0, 0.035, 0]} />
    </group>
  );
}

function SceneCallouts({ objects }: { objects: SceneObject[] }) {
  const visibleAssets = objects
    .filter((item) => item.defenseRole === "command" || item.defenseRole === "barrier" || item.defenseRole === "mesh")
    .slice(0, 7);

  return (
    <group>
      {criticalTargets.map((target) => (
        <Html
          key={target.id}
          position={[target.position[0], 18 + target.riskWeight * 8, target.position[2]]}
          center
          distanceFactor={260}
          className={styles.targetCallout}
        >
          <strong>{target.label}</strong>
          <span>Критический объект</span>
        </Html>
      ))}
      {visibleAssets.map((item) => (
        <Html
          key={`asset-callout-${item.id}`}
          position={[item.position[0], item.elevation + 12, item.position[2]]}
          center
          distanceFactor={240}
          className={styles.assetCallout}
        >
          <strong>{item.label}</strong>
          <span>{Math.round(item.effectiveness * 100)}% эффективность</span>
        </Html>
      ))}
    </group>
  );
}

function Coverage({ item, selected }: { item: SceneObject; selected: boolean }) {
  const color = defenseRoleColor[item.defenseRole] ?? kindColor[item.kind];
  const radius = item.coverageRadiusM;
  return (
    <group position={item.position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial color={selected ? "#55d6ff" : color} transparent opacity={selected ? 0.22 : 0.12} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.07, 0]}>
        <ringGeometry args={[Math.max(1, radius - 2.2), radius + 2.2, 96]} />
        <meshBasicMaterial color={selected ? "#ffffff" : color} transparent opacity={selected ? 0.78 : 0.48} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[Math.max(1, radius * 0.34 - 1.2), radius * 0.34 + 1.2, 72]} />
        <meshBasicMaterial color={selected ? "#ffffff" : color} transparent opacity={selected ? 0.54 : 0.32} depthWrite={false} />
      </mesh>
    </group>
  );
}

function ProtectiveAssetModel({
  kind,
  selected,
  ghost = false,
}: {
  kind: SceneObject["kind"];
  selected: boolean;
  ghost?: boolean;
}) {
  const config = scaledAssetByKind[kind];
  if (!config) {
    return (
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.35, 0.42, 2.4, 10]} />
        <meshStandardMaterial
          color="#5abdf4"
          emissive={selected ? "#22aef5" : "#0b3e5a"}
          emissiveIntensity={selected ? 0.55 : 0.2}
          metalness={0.28}
          roughness={0.38}
        />
      </mesh>
    );
  }

  return (
    <Suspense fallback={null}>
      <ScaledGlbModel
        url={config.url}
        assetType={config.assetType}
        upAxis={config.upAxis}
        scaleMode={config.scaleMode ?? "exact"}
        modelRotation={config.modelRotation ?? [0, 0, 0]}
        ghost={ghost}
      />
    </Suspense>
  );
}

function PlacementPreview({
  kind,
  point,
  viewMode,
}: {
  kind: ObjectKind;
  point: [number, number, number];
  viewMode: ViewMode;
}) {
  return (
    <group position={point}>
      {viewMode === "hex" ? (
        <mesh position={[0, 0.03, 0]} rotation={[0, Math.PI / 6, 0]}>
          <cylinderGeometry args={[HEX_SIZE_M * 0.9, HEX_SIZE_M * 0.9, 0.04, 6]} />
          <meshBasicMaterial color="#55d6ff" transparent opacity={0.48} />
        </mesh>
      ) : (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[2.05, 2.4, 48]} />
          <meshBasicMaterial color="#00b6ff" transparent opacity={0.6} />
        </mesh>
      )}
      <ProtectiveAssetModel kind={kind} selected={false} ghost />
    </group>
  );
}

function SceneUnit({
  item,
  selected,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
  snapPosition,
  viewMode,
  placementActive,
}: {
  item: SceneObject;
  selected: boolean;
  onSelect: () => void;
  onMove: (id: string, x: number, z: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  snapPosition: (x: number, z: number) => SnappedPosition;
  viewMode: ViewMode;
  placementActive: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const markerScale = 2.9;
  const markerInnerRadius = 0.85 * markerScale;
  const markerOuterRadius = (selected ? 1.02 : 0.95) * markerScale;

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setDragging(true);
    onDragStart();
    onSelect();
    (event.target as Element).setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (!dragging) return;
    event.stopPropagation();
    const intersection = new THREE.Vector3();
    if (event.ray.intersectPlane(levelPlane, intersection)) {
      const snapped = snapPosition(intersection.x, intersection.z);
      onMove(item.id, snapped.x, snapped.z);
    }
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setDragging(false);
    onDragEnd();
    (event.target as Element).releasePointerCapture(event.pointerId);
  };

  return (
    <group
      position={item.position}
      onPointerOver={() => {
        document.body.style.cursor = placementActive ? "crosshair" : "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
      onPointerDown={placementActive ? undefined : handlePointerDown}
      onPointerMove={placementActive ? undefined : handlePointerMove}
      onPointerUp={placementActive ? undefined : handlePointerUp}
      onClick={
        placementActive
          ? undefined
          : (event) => {
              event.stopPropagation();
              onSelect();
            }
      }
    >
      {viewMode === "hex" ? (
        <>
          <mesh position={[0, 0.42, 0]} rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[selected ? 7.2 : 6.2, selected ? 7.2 : 6.2, 0.76, 6]} />
            <meshBasicMaterial color={selected ? "#f7fbff" : kindColor[item.kind]} transparent opacity={0.92} />
          </mesh>
          <mesh position={[0, 0.86, 0]} rotation={[0, Math.PI / 6, 0]}>
            <cylinderGeometry args={[selected ? 8.9 : 7.6, selected ? 8.9 : 7.6, 0.08, 6]} />
            <meshBasicMaterial color={defenseRoleColor[item.defenseRole]} transparent opacity={selected ? 0.72 : 0.44} />
          </mesh>
        </>
      ) : (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
            <ringGeometry args={[markerInnerRadius, markerOuterRadius, 56]} />
            <meshBasicMaterial color={selected ? "#00b6ff" : kindColor[item.kind]} transparent opacity={0.88} />
          </mesh>
          <ProtectiveAssetModel kind={item.kind} selected={selected} />
        </>
      )}
    </group>
  );
}

const HIT_EFFECT_DURATION_SEC = 1.45;

function ImpactPulse({
  position,
  startedAt,
  status,
}: {
  position: [number, number, number];
  startedAt: number;
  status: "neutralized" | "breach";
}) {
  const ringRef = useRef<THREE.Mesh | null>(null);
  const domeRef = useRef<THREE.Mesh | null>(null);
  const isBreach = status === "breach";
  const ringColor = isBreach ? "#ff3730" : "#55e7bb";
  const domeColor = isBreach ? "#ff9a3d" : "#70c9ff";

  useFrame(({ clock }) => {
    const age = Math.max(0, clock.getElapsedTime() - startedAt);
    const life = Math.min(1, age / HIT_EFFECT_DURATION_SEC);
    const ringScale = 1 + life * (isBreach ? 14 : 8);
    const domeScale = 0.95 + life * (isBreach ? 5.4 : 3.2);
    const opacity = 0.95 - life * 0.95;

    if (ringRef.current) {
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      const ringMat = ringRef.current.material as THREE.MeshBasicMaterial;
      ringMat.opacity = Math.max(0, opacity);
    }
    if (domeRef.current) {
      domeRef.current.scale.setScalar(domeScale);
      const domeMat = domeRef.current.material as THREE.MeshBasicMaterial;
      domeMat.opacity = Math.max(0, opacity * 0.75);
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.4, 4.6, 58]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.98} />
      </mesh>
      <mesh ref={domeRef} position={[0, 0.26, 0]}>
        <sphereGeometry args={[0.82, 22, 22]} />
        <meshBasicMaterial color={domeColor} transparent opacity={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
        <ringGeometry args={[1.8, 2.6, 42]} />
        <meshBasicMaterial color={isBreach ? "#ffd27a" : "#d8fff2"} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

type DroneRuntimeState = {
  progress: number;
  hold: number;
  status: ThreatStatus;
  completed: boolean;
};

type ThreatEffect = {
  id: string;
  position: [number, number, number];
  startedAt: number;
  status: "neutralized" | "breach";
};

function initialDroneRuntime(): DroneRuntimeState[] {
  return threatTracks.map((_, index) => ({
    progress: (index * 0.11) % 0.34,
    hold: 0,
    status: "detected" as ThreatStatus,
    completed: false,
  }));
}

function threatStatusForProgress(progress: number, detectAt: number, trackAt: number): ThreatStatus {
  if (progress >= trackAt) return "tracking";
  if (progress >= detectAt) return "detected";
  return "detected";
}

function interpolateTrackPoint(from: [number, number, number], to: [number, number, number], progress: number) {
  return new THREE.Vector3(
    THREE.MathUtils.lerp(from[0], to[0], progress),
    THREE.MathUtils.lerp(from[1], to[1], progress),
    THREE.MathUtils.lerp(from[2], to[2], progress),
  );
}

function DroneSwarm({
  enabled,
  scenario,
}: {
  enabled: boolean;
  scenario: ScenarioId;
}) {
  const gltf = useGLTF(withBasePath("/models/chaklun-v2-drone.glb"));
  const drones = useMemo(
    () =>
      threatTracks.map((track) => ({
        id: track.id,
        model: gltf.scene.clone(true),
      })),
    [gltf.scene],
  );
  const refs = useRef<Array<THREE.Group | null>>([]);
  const runtimeRef = useRef<DroneRuntimeState[]>(initialDroneRuntime());
  const effectSequenceRef = useRef(0);
  const statusRef = useRef<ThreatStatus[]>(threatTracks.map(() => "detected"));
  const [statuses, setStatuses] = useState<ThreatStatus[]>(() => threatTracks.map(() => "detected"));
  const [effects, setEffects] = useState<ThreatEffect[]>([]);

  useFrame(({ clock }, delta) => {
    if (!enabled) return;
    const elapsed = clock.getElapsedTime();
    const nextStatuses = [...statusRef.current];
    const nextEffects: ThreatEffect[] = [];
    let statusChanged = false;

    threatTracks.forEach((track, index) => {
      const node = refs.current[index];
      const state = runtimeRef.current[index];
      if (!node || !state) return;

      const outcome = track.outcomeByScenario[scenario];
      if (state.completed) {
        state.hold += delta;
        if (state.hold > 2.6) {
          state.progress = 0;
          state.hold = 0;
          state.status = "detected";
          state.completed = false;
        }
      } else {
        state.progress += delta * track.speed;
        const shouldNeutralize = outcome === "neutralized" && state.progress >= track.neutralizeAt;
        const shouldBreach = outcome === "breach" && state.progress >= 1;

        if (shouldNeutralize || shouldBreach) {
          state.status = shouldNeutralize ? "neutralized" : "breach";
          state.completed = true;
          state.hold = 0;
          state.progress = shouldNeutralize ? track.neutralizeAt : 1;
          const impactPoint = interpolateTrackPoint(track.from, track.to, state.progress);
          nextEffects.push({
            id: `${track.id}-${effectSequenceRef.current++}`,
            position: [impactPoint.x, 0.2, impactPoint.z],
            startedAt: elapsed,
            status: state.status,
          });
        } else {
          state.status = threatStatusForProgress(state.progress, track.detectAt, track.trackAt);
        }
      }

      const nextPoint = interpolateTrackPoint(track.from, track.to, state.progress);
      node.position.copy(nextPoint);
      const dir = new THREE.Vector3(track.to[0] - track.from[0], 0, track.to[2] - track.from[2]).normalize();
      const headingOffset = Math.PI / 2;
      node.rotation.set(0, Math.atan2(dir.x, dir.z) + headingOffset, 0);

      if (nextStatuses[index] !== state.status) {
        nextStatuses[index] = state.status;
        statusChanged = true;
      }
    });

    if (statusChanged) {
      statusRef.current = nextStatuses;
      setStatuses(nextStatuses);
    }
    if (nextEffects.length > 0) {
      setEffects((prev) => [
        ...prev.filter((effect) => elapsed - effect.startedAt < HIT_EFFECT_DURATION_SEC),
        ...nextEffects,
      ].slice(-24));
    }
  });

  if (!enabled) return null;

  return (
    <group>
      {threatTracks.map((track) => {
        const outcome = track.outcomeByScenario[scenario];
        const color = outcome === "neutralized" ? "#55e7bb" : "#ff6b5f";
        return (
          <Line
            key={`${track.id}-path`}
            points={[track.from, track.to]}
            color={color}
            lineWidth={1.8}
            dashed
            dashScale={3}
            dashSize={0.7}
            gapSize={0.28}
            transparent
            opacity={0.86}
          />
        );
      })}
      {drones.map((drone, index) => {
        const status = statuses[index] ?? "detected";
        return (
          <group key={drone.id} ref={(node) => { refs.current[index] = node; }} scale={4.8}>
            <primitive object={drone.model} />
            <Html
              position={[0, 4.2, 0]}
              center
              distanceFactor={80}
              className={`${styles.threatBadge} ${styles[status]}`}
            >
              <span style={{ backgroundColor: threatStatusColor[status] }} />
              {threatStatusLabel[status]}
            </Html>
          </group>
        );
      })}
      {effects.map((effect) => (
        <ImpactPulse key={effect.id} position={effect.position} startedAt={effect.startedAt} status={effect.status} />
      ))}
    </group>
  );
}

function SimulationFallback() {
  return (
    <Html center>
      <div className={styles.simulationLoading}>Готовим симуляцию...</div>
    </Html>
  );
}

function CameraClamp({
  orbitRef,
  minHeight = 36,
}: {
  orbitRef: RefObject<{ target: THREE.Vector3 } | null>;
  minHeight?: number;
}) {
  useFrame(({ camera }) => {
    if (!orbitRef.current) return;
    orbitRef.current.target.y = 0;
    if (camera.position.y < minHeight) {
      camera.position.y = minHeight;
    }
  });

  return null;
}

function CameraPresetController({
  orbitRef,
  request,
  mapHalf,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: RefObject<any>;
  request: CameraPresetRequest;
  mapHalf: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const presets: Record<CameraPresetId, { position: [number, number, number]; target: [number, number, number] }> = {
      overview: {
        position: [mapHalf * 0.92, mapHalf * 0.64, mapHalf * 0.92],
        target: [0, 0, 0],
      },
      perimeter: {
        position: [-220, 250, 360],
        target: [52, 0, 75],
      },
      tanks: {
        position: [340, 220, 260],
        target: [174, 0, 132],
      },
      operator: {
        position: [-190, 190, 360],
        target: [-18, 0, 220],
      },
    };
    const preset = presets[request.id];
    camera.position.set(...preset.position);
    if (orbitRef.current) {
      orbitRef.current.target.set(...preset.target);
      orbitRef.current.update?.();
    }
  }, [camera, mapHalf, orbitRef, request.id, request.nonce]);

  return null;
}

function CameraViewModeController({
  orbitRef,
  viewMode,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  orbitRef: RefObject<any>;
  viewMode: ViewMode;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (viewMode !== "hex") return;
    camera.position.set(0, 620, 24);
    if (orbitRef.current) {
      orbitRef.current.target.set(0, 0, 0);
      orbitRef.current.update?.();
    }
  }, [camera, orbitRef, viewMode]);

  return null;
}

export function PrototypeScene({
  objects,
  plantObjects,
  plantConnections,
  selectedId,
  setSelectedId,
  updateObjectPosition,
  demoMode,
  scenario,
  theme,
  viewMode,
  placingKind,
  placementPoint,
  cameraPresetRequest,
  onPlacementMove,
  onPlacePending,
  onCancelPlacement,
}: {
  objects: SceneObject[];
  plantObjects: PlantMapObject[];
  plantConnections: PlantMapConnection[];
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  updateObjectPosition: (id: string, x: number, z: number) => void;
  demoMode: boolean;
  scenario: ScenarioId;
  theme: "light" | "dark";
  viewMode: ViewMode;
  placingKind: ObjectKind | null;
  placementPoint: [number, number, number];
  cameraPresetRequest: CameraPresetRequest;
  onPlacementMove: (x: number, z: number) => void;
  onPlacePending: () => void;
  onCancelPlacement: () => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orbitRef = useRef<any>(null);
  const mapHalfX = (plantSite.width * PLANT_SCALE) / 2 + 40;
  const mapHalfZ = (plantSite.depth * PLANT_SCALE) / 2 + 40;
  const mapHalf = Math.max(mapHalfX, mapHalfZ);
  const showZoneOverlay = false;
  const isDark = theme === "dark";
  const sceneBackground = isDark ? "#0b1218" : "#f4f8ff";
  const fogColor = isDark ? "#0b1218" : "#f4f8ff";
  const gridCellColor = isDark ? "#4f89d5" : "#2f7dd3";
  const gridSectionColor = isDark ? "#79a8e2" : "#1f5fa6";
  const groundColor = isDark ? "#213140" : plantSite.groundColor;

  const handleDragStart = () => {
    if (orbitRef.current) orbitRef.current.enabled = false;
  };

  const handleDragEnd = () => {
    if (orbitRef.current) orbitRef.current.enabled = true;
  };

  const handlePlacementMove = (event: ThreeEvent<PointerEvent>) => {
    if (!placingKind) return;
    const intersection = new THREE.Vector3();
    if (event.ray.intersectPlane(levelPlane, intersection)) {
      const snapped = viewMode === "hex"
        ? snapToHexCenter(intersection.x, intersection.z, HEX_SIZE_M)
        : { x: snapToGrid(intersection.x), z: snapToGrid(intersection.z) };
      onPlacementMove(snapped.x, snapped.z);
    }
  };

  const snapPosition = useCallback((x: number, z: number): SnappedPosition => {
    if (viewMode === "hex") return snapToHexCenter(x, z, HEX_SIZE_M);
    return { x: snapToGrid(x), z: snapToGrid(z) };
  }, [viewMode]);

  return (
    <Canvas
      shadows={viewMode === "scene3d"}
      dpr={viewMode === "hex" ? [1, 1] : [1, 1.5]}
      gl={{ antialias: true, logarithmicDepthBuffer: viewMode === "scene3d" }}
      camera={{ position: [mapHalf * 0.92, mapHalf * 0.64, mapHalf * 0.92], fov: 38, near: 0.1, far: mapHalf * 14 }}
      onPointerMissed={() => setSelectedId(null)}
      className={styles.canvas}
    >
      <color attach="background" args={[sceneBackground]} />
      <fog attach="fog" args={[fogColor, mapHalf * 1.4, mapHalf * 5]} />
      <ambientLight intensity={isDark ? 0.62 : demoMode ? 0.9 : 0.82} />
      <directionalLight
        castShadow={viewMode === "scene3d"}
        intensity={viewMode === "hex" ? 0.9 : isDark ? 1.15 : 1.45}
        position={[160, 220, 120]}
        color="#ffffff"
        shadow-mapSize-width={viewMode === "hex" ? 512 : 2048}
        shadow-mapSize-height={viewMode === "hex" ? 512 : 2048}
      />

      <group scale={[PLANT_SCALE, PLANT_SCALE, PLANT_SCALE]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.16, 0]} receiveShadow={viewMode === "scene3d"}>
          <planeGeometry args={[plantSite.width, plantSite.depth]} />
          <meshStandardMaterial color={groundColor} roughness={plantSite.groundRoughness} metalness={0.02} />
        </mesh>
      </group>
      {viewMode === "scene3d" ? (
        <Grid
          args={[mapHalf * 2, mapHalf * 2]}
          position={[0, -0.06, 0]}
          cellSize={2}
          cellThickness={0.28}
          cellColor={gridCellColor}
          sectionSize={20}
          sectionThickness={0.7}
          sectionColor={gridSectionColor}
          fadeDistance={100000}
          fadeStrength={0}
        />
      ) : null}
      {viewMode === "scene3d" ? <RiskHeatmap scenario={scenario} /> : null}
      {viewMode === "hex" ? (
        <HexGridOverlay mapHalfX={mapHalfX} mapHalfZ={mapHalfZ} objects={objects} scenario={scenario} />
      ) : null}
      {placingKind ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.08, 0]}
          onPointerMove={handlePlacementMove}
          onClick={(event) => {
            event.stopPropagation();
            onPlacePending();
          }}
          onContextMenu={(event) => {
            event.stopPropagation();
            onCancelPlacement();
          }}
        >
          <planeGeometry args={[mapHalf * 2, mapHalf * 2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}

      {viewMode === "scene3d" ? (
        <group scale={[PLANT_SCALE, PLANT_SCALE, PLANT_SCALE]}>
          {showZoneOverlay
            ? plantZones.map((zone) => (
                <mesh key={zone.id} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                  <shapeGeometry args={[zoneShape(zone.polygon)]} />
                  <meshBasicMaterial
                    color={zone.color}
                    transparent
                    opacity={Math.min(0.08, zone.opacity)}
                    depthWrite={false}
                    polygonOffset
                    polygonOffsetFactor={2}
                    polygonOffsetUnits={2}
                  />
                </mesh>
              ))
            : null}

          <FenceFromPerimeter />

          {plantObjects.map((item) => (
            <PlantObjectUnit
              key={item.id}
              item={item}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}

          {plantConnections.map((item) => {
            if (item.type === "pipeline") return <PipelineConnection key={item.id} item={item} />;
            if (item.type === "route") return <RouteConnection key={item.id} item={item} color="#7d8797" />;
            return <RouteConnection key={item.id} item={item} color="#8e99aa" />;
          })}
        </group>
      ) : null}

      <Suspense fallback={<SimulationFallback />}>
        {demoMode && viewMode === "scene3d" ? <DroneSwarm key={scenario} enabled={demoMode} scenario={scenario} /> : null}
      </Suspense>

      {viewMode === "scene3d" ? <SceneCallouts objects={objects} /> : null}
      {viewMode === "scene3d"
        ? objects.map((item) => (
            <Coverage key={`coverage-${item.id}`} item={item} selected={selectedId === item.id} />
          ))
        : null}
      {objects.map((item) => (
        <SceneUnit
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onSelect={() => setSelectedId(item.id)}
          onMove={updateObjectPosition}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          snapPosition={snapPosition}
          viewMode={viewMode}
          placementActive={Boolean(placingKind)}
        />
      ))}
      {placingKind ? <PlacementPreview kind={placingKind} point={placementPoint} viewMode={viewMode} /> : null}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enableRotate={viewMode === "scene3d"}
        enablePan
        screenSpacePanning={false}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: THREE.TOUCH.ROTATE,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
        target={[0, 0, 0]}
        maxPolarAngle={viewMode === "hex" ? Math.PI * 0.11 : Math.PI * 0.42}
        minPolarAngle={viewMode === "hex" ? Math.PI * 0.04 : Math.PI * 0.25}
        minDistance={Math.max(220, mapHalf * 0.42)}
        maxDistance={Math.max(1600, mapHalf * 3.9)}
      />
      <CameraClamp orbitRef={orbitRef} minHeight={Math.max(84, mapHalf * 0.16)} />
      <CameraPresetController orbitRef={orbitRef} request={cameraPresetRequest} mapHalf={mapHalf} />
      <CameraViewModeController orbitRef={orbitRef} viewMode={viewMode} />
    </Canvas>
  );
}

useGLTF.preload(withBasePath("/models/protection/02_cable_mesh_curtain_textured.glb"));
useGLTF.preload(withBasePath("/models/protection/03_fbs_protection_enclosure_textured.glb"));
useGLTF.preload(withBasePath("/models/protection/04_perimeter_fbs_cable_barrier_textured.glb"));
useGLTF.preload(withBasePath("/models/protection/05_protective_scaffolding_with_equipment_textured.glb"));
useGLTF.preload(withBasePath("/models/protective/operator_substation_protected.glb"));
useGLTF.preload(withBasePath("/models/protective/protective_scaffolding_with_equipment.glb"));
useGLTF.preload(withBasePath("/models/protective/fbs_protection_enclosure.glb"));
useGLTF.preload(withBasePath("/models/protective/perimeter_fbs_cable_barrier.glb"));
useGLTF.preload(withBasePath("/models/protective/cable_mesh_curtain_module.glb"));
