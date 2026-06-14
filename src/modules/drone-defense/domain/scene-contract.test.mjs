import { readFileSync } from "node:fs";

const sceneSource = readFileSync("src/modules/drone-defense/ui/scene.tsx", "utf8");

const preloadCalls = sceneSource.match(/useGLTF\.preload\s*\([^)]*\)/g) ?? [];
const modelPreloads = preloadCalls.filter((entry) => entry.includes("/models/") && entry.includes(".glb"));

if (modelPreloads.length > 0) {
  throw new Error(`Scene module must not preload eager GLB models on mount: ${modelPreloads.join(", ")}`);
}

console.log("scene-contract.test.mjs: no eager /models/*.glb preloads in scene module");
