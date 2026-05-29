import type { DefenseAssetKind } from "@/shared/types/drone-defense";

export type LegacyObjectKind = "sensor" | "camera" | "shield" | "post" | "barrier";
export type ObjectKind = LegacyObjectKind | DefenseAssetKind;

export const kindLabel: Record<ObjectKind, string> = {
  operator_substation: "Операторная / подстанция",
  scaffolding: "Защитные строительные леса",
  fbs_enclosure: "ФБС-защита",
  perimeter_barrier: "Периметральная ФБС-линия",
  cable_mesh: "Сеточная тросовая завеса",
  sensor: "Сенсорная мачта",
  camera: "Камера",
  shield: "Защитный купол",
  post: "Пост управления",
  barrier: "Барьер",
};

export const kindColor: Record<ObjectKind, string> = {
  operator_substation: "#55d6ff",
  scaffolding: "#67e8a6",
  fbs_enclosure: "#f4c860",
  perimeter_barrier: "#ff9b63",
  cable_mesh: "#c5d6e5",
  sensor: "#4cc8ff",
  camera: "#5cc7f5",
  shield: "#f4c24e",
  post: "#9cc9e5",
  barrier: "#d8b16c",
};
