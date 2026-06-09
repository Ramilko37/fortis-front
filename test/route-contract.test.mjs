import { existsSync } from "node:fs";
import { resolve } from "node:path";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const root = resolve(import.meta.dirname, "..");

assert(
  !existsSync(resolve(root, "src/app/models/page.tsx")),
  "legacy /models route must not be present",
);

assert(
  !existsSync(resolve(root, "src/modules/models/ui/model-library-page.tsx")),
  "legacy model library UI must not be present",
);
