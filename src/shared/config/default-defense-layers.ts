import type { EditableDefenseLayer, ProtectedObject } from "@/shared/types/defense-project";

export const defaultProtectedObject: ProtectedObject = {
  id: "facility-alpha",
  name: "Завод Альфа",
  center: { lat: 55.1, lng: 37.1 },
};

const layerColors = ["#2563eb", "#0891b2", "#0d9488", "#059669", "#65a30d", "#ca8a04", "#ea580c", "#dc2626", "#7c3aed"];

const layerNames = [
  ["L1", "Внешнее предупреждение", "60-120 км", 60000, 120000],
  ["L2", "Обнаружение", "30-60 км", 30000, 60000],
  ["L3", "Идентификация", "15-30 км", 15000, 30000],
  ["L4", "Подавление", "8-15 км", 8000, 15000],
  ["L5", "Средний рубеж", "4-8 км", 4000, 8000],
  ["L6", "Последний рубеж", "1,5-4 км", 1500, 4000],
  ["L7", "Срыв точности", "0,5-1,5 км", 500, 1500],
  ["L8", "Пассивная защита", "100-500 м", 100, 500],
  ["L9", "Hardening", "0-100 м", 0, 100],
] as const;

export const defaultDefenseProjectLayers: EditableDefenseLayer[] = layerNames.map(([code, name, description, minRadiusM, maxRadiusM], index) => {
  const order = index + 1;
  return {
    id: `layer_${String(order).padStart(2, "0")}_${code.toLowerCase()}`,
    name,
    code,
    description,
    order,
    distanceFromObjectMin: minRadiusM,
    distanceFromObjectMax: maxRadiusM,
    geometryType: "ring",
    geometry: {
      type: "ring",
      center: defaultProtectedObject.center,
      minRadiusM,
      maxRadiusM,
    },
    color: layerColors[index],
    opacity: 0.16,
    isActive: order === 2,
    isVisible: true,
    isLocked: false,
  };
});
