export const THREAT_TYPES = [
  { id: "fixed_wing_uav", name: "Самолётный БПЛА" },
  { id: "fpv", name: "FPV" },
  { id: "loitering", name: "Барражирующий БПЛА" },
  { id: "swarm", name: "Групповая атака / рой" },
] as const;

export type ThreatTypeRef = (typeof THREAT_TYPES)[number];
