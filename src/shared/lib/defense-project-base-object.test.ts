// Run: pnpm exec tsx src/shared/lib/defense-project-base-object.test.ts

import { createDefaultDefenseProject, setProjectBaseObject } from "@/shared/lib/defense-project";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const project = createDefaultDefenseProject();
const replacedBaseObject = setProjectBaseObject(project, {
  id: "enterprise-1",
  name: "АО Северный терминал",
  center: { lat: 56.8389, lng: 60.6057 },
});
const replacedL2 = replacedBaseObject.layers.find((layer) => layer.code === "L2");

assert(replacedBaseObject.baseObject.id === "enterprise-1", "setProjectBaseObject must replace protected object id");
assert(replacedBaseObject.baseObject.name === "АО Северный терминал", "setProjectBaseObject must replace protected object name");
assert(replacedBaseObject.baseObject.center.lng === 60.6057, "setProjectBaseObject must replace protected object center");
assert(
  replacedL2?.geometry.type === "ring" && replacedL2.geometry.center.lat === 56.8389,
  "setProjectBaseObject must keep ring layers centered on the selected protected object",
);

console.log("defense-project-base-object.test.ts: base object contracts passed");
