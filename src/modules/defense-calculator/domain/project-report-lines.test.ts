// Run: npx tsx src/modules/defense-calculator/domain/project-report-lines.test.ts

import {
  createDefaultDefenseProject,
  placeObjectInProject,
  updatePlacedObjectInProject,
} from "@/shared/lib/defense-project";
import { buildProjectReportObjectLines } from "@/modules/defense-calculator/domain/project-report-lines";
import type { PlacedDefenseObject } from "@/shared/types/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function getMogLineByObjectId(lines: ReturnType<typeof buildProjectReportObjectLines>, objectId: string) {
  const line = lines.find((item) => item.objectId === objectId);
  assert(line, `expected report line for placed object ${objectId}`);
  return line;
}

// Empty project returns no object report lines.
{
  const project = createDefaultDefenseProject();
  const lines = buildProjectReportObjectLines(project);
  assert(lines.length === 0, `empty project must return no lines, got ${lines.length}`);
}

// МОГ in L5 creates a report line with compound summary.
{
  let project = createDefaultDefenseProject();
  const mogAsset = project.assetLibrary.find((asset) => asset.id === "l5-mobile-fire");
  assert(mogAsset, "fixture needs l5-mobile-fire asset");
  const l5Layer = project.layers.find((layer) => layer.code === "L5");
  assert(l5Layer, "fixture needs L5 layer");

  project = placeObjectInProject(project, mogAsset.id, l5Layer.id, project.baseObject.center, { quantity: 2 });
  const placed = project.placedObjects[0];
  assert(placed, "placing МОГ should add a placed object");

  const lines = buildProjectReportObjectLines(project);
  assert(lines.length === 1, `expected one report line, got ${lines.length}`);

  const line = getMogLineByObjectId(lines, placed.id);
  assert(line.objectId === placed.id, "line should reference original object id");
  assert(line.layerCode === "L5", `expected L5 layer code, got ${line.layerCode}`);
  assert(line.isCompoundPost, "МОГ line must be marked as compound");
  assert(line.protectionType === "МОГ", `expected protection type МОГ, got ${line.protectionType}`);
  assert(line.lineTotalMln === 70, `line total must use demo price × quantity (70), got ${line.lineTotalMln}`);
  assert(typeof line.compositionSummary === "string" && line.compositionSummary.includes("Пост: МОГ"), "compound summary must include post type");
  assert(typeof line.weaponSummary === "string" && line.weaponSummary.includes("Оружие:"), "weapon summary must include label");
  assert(typeof line.azimuthSectorSummary === "string" && line.azimuthSectorSummary.includes("Азимут:"), "azimuth summary must include label");
}

// Updates of compound profile fields are reflected in helper output.
{
  let project = createDefaultDefenseProject();
  const mogAsset = project.assetLibrary.find((asset) => asset.id === "l5-mobile-fire");
  assert(mogAsset, "fixture needs l5-mobile-fire asset");
  const l5Layer = project.layers.find((layer) => layer.code === "L5");
  assert(l5Layer, "fixture needs L5 layer");

  project = placeObjectInProject(project, mogAsset.id, l5Layer.id, project.baseObject.center);
  const placed = project.placedObjects[0] as PlacedDefenseObject;
  assert(placed.compoundProfile, "placed МОГ must have compound profile");
  project = updatePlacedObjectInProject(project, placed.id, {
    compoundProfile: {
      ...placed.compoundProfile,
      azimuth: 180,
      weaponUnits: "6",
      armament: "Дроны-перехватчики",
    },
  });

  const updatedLines = buildProjectReportObjectLines(project);
  const updatedLine = getMogLineByObjectId(updatedLines, placed.id);
  assert(updatedLine.isCompoundPost, "updated object must remain compound");
  assert((updatedLine.weaponSummary ?? "").includes("6"), "updated weapon units must be reflected in weapon summary");
  assert((updatedLine.azimuthSectorSummary ?? "").includes("180°"), "updated azimuth must be reflected in report line");
}

// Non-compound object should not receive compound summaries.
{
  let project = createDefaultDefenseProject();
  const kineticAsset = project.assetLibrary.find((asset) => asset.id === "mobile-radar");
  assert(kineticAsset, "fixture needs non-compound asset");
  project = placeObjectInProject(project, kineticAsset.id, project.layers[0]!.id, project.baseObject.center);

  const lines = buildProjectReportObjectLines(project);
  assert(lines.length === 1, `expected one report line, got ${lines.length}`);
  const line = lines[0];
  assert(!line.isCompoundPost, "non-compound object must not be marked compound");
  assert(line.compositionSummary === undefined, "non-compound object must not have composition summary");
  assert(line.azimuthSectorSummary === undefined, "non-compound object must not have azimuth-sector summary");
}

console.log("project-report-lines: OK");
