import type { DefenseAssetKind } from "@/shared/types/drone-defense";

export type LegacyObjectKind = "sensor" | "camera" | "shield" | "post" | "barrier";
export type ObjectKind = LegacyObjectKind | DefenseAssetKind;
export type ScenarioId =
  | "unprotected"
  | "baseline"
  | "perimeter"
  | "assets"
  | "night"
  | "balanced"
  | "reinforced";

export type SceneObject = {
  id: string;
  kind: ObjectKind;
  label: string;
  position: [number, number, number];
  radius: number;
  coverageRadiusM: number;
  elevation: number;
  zones: number;
  assignment: string;
  defenseRole: "command" | "scaffold" | "enclosure" | "barrier" | "mesh";
  costMln: number;
  effectiveness: number;
};

export type SiteStatus = "active" | "configuring" | "offline";

export type Site = {
  id: string;
  name: string;
  address: string;
  status: SiteStatus;
  coveragePercent: number;
  devicesCount: number;
  lastIncident?: Date;
  configurationId?: string;
};

export type SiteConfiguration = {
  siteId: string;
  scenarioId: ScenarioId;
  objects: SceneObject[];
  lastSyncedAt: Date;
  version: number;
};

export type DeviceStatus = {
  objectId: string;
  online: boolean;
  batteryLevel?: number;
  lastPing: Date;
  signalStrength?: number;
};

export type ThreatLevel = "low" | "medium" | "high" | "critical";
export type ThreatEventStatus = "detected" | "acknowledged" | "false_alarm" | "alarm_raised";

export type ThreatEvent = {
  id: string;
  siteId: string;
  siteName: string;
  sourceId: string;
  sourceKind: ObjectKind;
  sourceLabel: string;
  detectedAt: Date;
  threatLevel: ThreatLevel;
  zone: string;
  status: ThreatEventStatus;
  operatorId?: string;
  notes?: string;
};

export type GlobalAlertStatus = "normal" | "threat_detected" | "alarm_active";

export type AlertState = {
  siteId: string;
  siteName: string;
  status: GlobalAlertStatus;
  activeAlertId?: string;
  updatedAt: Date;
};

export type TeamRole = "admin" | "operator" | "viewer";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: TeamRole;
  siteIds: string[];
  smsNotifications: boolean;
  lastSeenAt?: Date;
};
