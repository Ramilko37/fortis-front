import type {
  Site,
  ThreatEvent,
  TeamMember,
  SiteConfiguration,
  DeviceStatus,
  SceneObject,
} from "@/shared/types/defense";

const baselineObjects: SceneObject[] = [
  {
    id: "cfg-baseline-operator",
    kind: "operator_substation",
    label: "Операторная / подстанция",
    position: [-18, 0, 220],
    radius: 140,
    coverageRadiusM: 140,
    elevation: 12,
    zones: 2,
    assignment: "Сетка Альфа",
    defenseRole: "command",
    costMln: 38,
    effectiveness: 0.78,
  },
  {
    id: "cfg-baseline-fbs",
    kind: "fbs_enclosure",
    label: "ФБС-защита резервуарного парка",
    position: [174, 0, 174],
    radius: 115,
    coverageRadiusM: 115,
    elevation: 9,
    zones: 1,
    assignment: "Сетка Альфа",
    defenseRole: "enclosure",
    costMln: 28,
    effectiveness: 0.66,
  },
];

const perimeterObjects: SceneObject[] = [
  ...baselineObjects,
  {
    id: "cfg-perimeter-line",
    kind: "perimeter_barrier",
    label: "ФБС-линия восточного въезда",
    position: [297, 0, -300],
    radius: 120,
    coverageRadiusM: 120,
    elevation: 8,
    zones: 2,
    assignment: "Сетка Бета",
    defenseRole: "barrier",
    costMln: 22,
    effectiveness: 0.7,
  },
];

// ─── Объекты ─────────────────────────────────────────────────────────────────

export const mockSites: Site[] = [
  {
    id: "site-alpha",
    name: "Завод Альфа",
    address: "Екатеринбург, ул. Промышленная, 12",
    status: "active",
    coveragePercent: 91,
    devicesCount: 8,
    lastIncident: new Date("2026-05-05T14:32:00"),
  },
  {
    id: "site-beta",
    name: "Склад Б",
    address: "Екатеринбург, ул. Складская, 4",
    status: "active",
    coveragePercent: 78,
    devicesCount: 5,
    lastIncident: new Date("2026-04-28T09:15:00"),
  },
  {
    id: "site-gamma",
    name: "Резервуарный парк",
    address: "Нижний Тагил, ш. Серовское, 88",
    status: "configuring",
    coveragePercent: 43,
    devicesCount: 3,
  },
  {
    id: "site-delta",
    name: "КПП Д",
    address: "Екатеринбург, пр. Космонавтов, 1",
    status: "offline",
    coveragePercent: 0,
    devicesCount: 0,
  },
];

// ─── Конфигурации объектов ────────────────────────────────────────────────────

export const mockConfigurations: SiteConfiguration[] = [
  {
    siteId: "site-alpha",
    scenarioId: "baseline",
    objects: baselineObjects,
    lastSyncedAt: new Date("2026-05-07T10:00:00"),
    version: 3,
  },
  {
    siteId: "site-beta",
    scenarioId: "perimeter",
    objects: perimeterObjects,
    lastSyncedAt: new Date("2026-05-06T16:30:00"),
    version: 2,
  },
  {
    siteId: "site-gamma",
    scenarioId: "balanced",
    objects: baselineObjects,
    lastSyncedAt: new Date("2026-05-01T09:00:00"),
    version: 1,
  },
];

// ─── Статусы устройств ────────────────────────────────────────────────────────

export const mockDeviceStatuses: DeviceStatus[] = [
  { objectId: "sensor-07", online: true,  lastPing: new Date("2026-05-07T22:55:00"), signalStrength: 92, batteryLevel: 87 },
  { objectId: "sensor-02", online: true,  lastPing: new Date("2026-05-07T22:55:00"), signalStrength: 88, batteryLevel: 74 },
  { objectId: "sensor-11", online: true,  lastPing: new Date("2026-05-07T22:54:00"), signalStrength: 95, batteryLevel: 91 },
  { objectId: "camera-04", online: true,  lastPing: new Date("2026-05-07T22:55:00"), signalStrength: 79 },
  { objectId: "camera-09", online: false, lastPing: new Date("2026-05-07T21:10:00"), signalStrength: 0  },
  { objectId: "shield-03", online: true,  lastPing: new Date("2026-05-07T22:55:00"), signalStrength: 85 },
  { objectId: "post-01",   online: true,  lastPing: new Date("2026-05-07T22:53:00"), signalStrength: 97 },
  { objectId: "post-04",   online: true,  lastPing: new Date("2026-05-07T22:55:00"), signalStrength: 91 },
];

// ─── События угроз ────────────────────────────────────────────────────────────

export const mockThreatEvents: ThreatEvent[] = [
  {
    id: "evt-001",
    siteId: "site-alpha",
    siteName: "Завод Альфа",
    sourceId: "sensor-07",
    sourceKind: "sensor",
    sourceLabel: "Sensor Mast 07",
    detectedAt: new Date("2026-05-07T22:51:00"),
    threatLevel: "high",
    zone: "North Post",
    status: "detected",
    notes: "Объект движется со стороны северного периметра",
  },
  {
    id: "evt-002",
    siteId: "site-alpha",
    siteName: "Завод Альфа",
    sourceId: "camera-04",
    sourceKind: "camera",
    sourceLabel: "Camera 04",
    detectedAt: new Date("2026-05-05T14:32:00"),
    threatLevel: "critical",
    zone: "Gate Alpha",
    status: "alarm_raised",
    operatorId: "admin",
    notes: "Дрон типа квадрокоптер, высота ~50м",
  },
  {
    id: "evt-003",
    siteId: "site-beta",
    siteName: "Склад Б",
    sourceId: "sensor-01",
    sourceKind: "sensor",
    sourceLabel: "Sensor Mast 01",
    detectedAt: new Date("2026-04-28T09:15:00"),
    threatLevel: "medium",
    zone: "West Fence",
    status: "false_alarm",
    operatorId: "admin",
    notes: "Птица, ложное срабатывание",
  },
  {
    id: "evt-004",
    siteId: "site-alpha",
    siteName: "Завод Альфа",
    sourceId: "sensor-11",
    sourceKind: "sensor",
    sourceLabel: "Sensor Mast 11",
    detectedAt: new Date("2026-04-20T03:22:00"),
    threatLevel: "low",
    zone: "South Post",
    status: "acknowledged",
    operatorId: "admin",
  },
];

// ─── Команда ─────────────────────────────────────────────────────────────────

export const mockTeamMembers: TeamMember[] = [
  {
    id: "user-01",
    name: "Администратор",
    email: "admin@fortis.io",
    phone: "+7 912 345-67-89",
    role: "admin",
    siteIds: ["site-alpha", "site-beta", "site-gamma", "site-delta"],
    smsNotifications: true,
    lastSeenAt: new Date("2026-05-07T22:50:00"),
  },
  {
    id: "user-02",
    name: "Иванов Дмитрий",
    email: "d.ivanov@fortis.io",
    phone: "+7 922 111-22-33",
    role: "operator",
    siteIds: ["site-alpha", "site-beta"],
    smsNotifications: true,
    lastSeenAt: new Date("2026-05-07T20:14:00"),
  },
  {
    id: "user-03",
    name: "Петрова Анна",
    email: "a.petrova@fortis.io",
    role: "viewer",
    siteIds: ["site-alpha"],
    smsNotifications: false,
    lastSeenAt: new Date("2026-05-06T11:00:00"),
  },
];
