import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/modules/drone-defense/ui/drone-defense-prototype.tsx", "utf8");

assert(
  source.includes('data-sidebar-state={isCatalogTrayOpen ? "open" : "closed"}'),
  "Catalog sidebar must stay mounted and expose open/closed state for smooth transitions",
);
assert(
  source.includes("transition-[max-height,width,transform,opacity]") &&
    source.includes("duration-300") &&
    source.includes("ease-in-out"),
  "Catalog sidebar must animate open/closed size and opacity",
);
assert(
  source.includes("isCatalogTrayOpen ? \"") && source.includes("lg:w-[320px]") && source.includes("lg:w-0"),
  "Catalog sidebar must animate desktop width instead of unmounting",
);
assert(
  source.includes("pointer-events-none") && source.includes("opacity-0"),
  "Closed catalog sidebar must not capture pointer events while hidden",
);
assert(
  source.includes("lg:border-r-0") && source.includes("border-b-0"),
  "Closed catalog sidebar must remove borders so it collapses without a 1px remainder",
);
assert(
  source.includes('data-sidebar-toggle-state={isCatalogTrayOpen ? "hidden" : "visible"}') &&
    source.includes("translate-x-0") &&
    source.includes("-translate-x-2"),
  "Catalog sidebar opener must fade/slide in when the sidebar closes",
);
assert(
  !source.includes("{isCatalogTrayOpen ? (\n        <section"),
  "Catalog sidebar must not be conditionally mounted because that prevents smooth closing",
);

console.log("catalog-sidebar-motion-contract.test.mjs: catalog sidebar animates open and closed");
