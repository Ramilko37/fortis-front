// Run: npx tsx src/modules/defense-calculator/domain/structural-profile.test.ts

import { createDefaultDefenseProject, placeObjectInProject } from "@/shared/lib/defense-project";
import { buildStructuralProfile } from "@/modules/defense-calculator/domain/structural-profile";
import type { DefenseProject } from "@/shared/types/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// Empty map → all zeros.
{
  const empty = createDefaultDefenseProject();
  const profile = buildStructuralProfile(empty);
  assert(profile.objectCount === 0, "empty objectCount must be 0");
  assert(profile.unitCount === 0, "empty unitCount must be 0");
  assert(profile.echelonCount === 0, "empty echelonCount must be 0");
  assert(profile.categoryCount === 0, "empty categoryCount must be 0");
  assert(profile.conflictCount === 0, "empty conflictCount must be 0");
  assert(profile.coverageZoneCount === 0, "empty coverageZoneCount must be 0");
  assert(profile.totalMln === 0, "empty totalMln must be 0");
  assert(profile.byEchelon.length === 0, "empty byEchelon must be empty");
}

// Map with placed objects → structural counts reflect them.
{
  let project: DefenseProject = createDefaultDefenseProject();
  const layer = project.layers[0];
  const withCoverage = project.assetLibrary.find((a) => a.coverageType !== "none");
  const noCoverage = project.assetLibrary.find((a) => a.coverageType === "none");
  assert(withCoverage, "fixture needs an asset with coverage");
  assert(noCoverage, "fixture needs an asset without coverage");

  // validateObjectPlacement ignores coordinates (it does `void coordinates`), so any point works.
  const at = project.baseObject.center;
  project = placeObjectInProject(project, withCoverage.id, layer.id, at, { quantity: 2 });
  project = placeObjectInProject(project, noCoverage.id, layer.id, at, { quantity: 1 });
  assert(project.placedObjects.length === 2, "fixture must place exactly 2 objects");

  const profile = buildStructuralProfile(project);
  assert(profile.objectCount === 2, `objectCount expected 2, got ${profile.objectCount}`);
  assert(profile.unitCount === 3, `unitCount expected 3, got ${profile.unitCount}`);
  assert(profile.echelonCount === 1, `echelonCount expected 1, got ${profile.echelonCount}`);
  assert(profile.coverageZoneCount === 1, `coverageZoneCount expected 1 (only the covered asset), got ${profile.coverageZoneCount}`);
  assert(profile.categoryCount >= 1, "categoryCount must count distinct categories");
  assert(profile.byEchelon.length === 1, "byEchelon must have one occupied echelon");
  assert(profile.byEchelon[0].objectCount === 2, "byEchelon objectCount mismatch");
}

console.log("structural-profile: OK");
