
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
CURRENT_SCHEMA_VERSION,
LAYER_CATEGORIES,
LAYER_FIELD_SPECS,
LAYER_LABELS,
LAYER_ORDER,
SAFETY_CAPS,
} from "../packages/aura-schema/src/index";

const ROOT=join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT=join(ROOT, "server", "cereva_proxy", "layer_schema.json");

const payload={
_comment:
"GENERATED FILE. Do not edit by hand. Source of truth is " +
"packages/aura-schema/src/fieldSpecs.ts. Regenerate with: npm run schema:export",
schemaVersion: CURRENT_SCHEMA_VERSION,
layerOrder: LAYER_ORDER,
layerLabels: LAYER_LABELS,
layerCategories: LAYER_CATEGORIES,
safetyCaps: SAFETY_CAPS,
layers: LAYER_FIELD_SPECS,
};

const text=JSON.stringify(payload, null, 2) + "\n";

const check=process.argv.includes("--check");

if(check){
let existing: string;
try {
existing=readFileSync(OUT, "utf8");
}catch {
console.error(
`FAIL: ${OUT} does not exist.\nRun: npm run schema:export`,
);
process.exit(1);
}
if(existing !== text){
const hashOf=(s: string) => createHash("sha256").update(s).digest("hex").slice(0, 12);
console.error(
"FAIL: the exported layer schema is out of date.\n" +
`  committed: ${hashOf(existing)}\n` +
`  generated: ${hashOf(text)}\n` +
"The field spec table changed without regenerating the server's copy.\n" +
"Run: npm run schema:export",
);
process.exit(1);
}
console.log("OK: the server's layer schema matches the field spec table");
process.exit(0);
}

writeFileSync(OUT, text, "utf8");
const layerCount=Object.keys(LAYER_FIELD_SPECS).length;
const fieldCount=Object.values(LAYER_FIELD_SPECS).reduce(
(n, fields) => n + Object.keys(fields).length,
0,
);
console.log(
`wrote ${OUT}\n  ${layerCount} layers, ${fieldCount} fields, ${SAFETY_CAPS.length} safety caps`,
);
