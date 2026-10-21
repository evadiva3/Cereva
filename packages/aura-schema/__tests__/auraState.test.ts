
import {
AURA_PRESETS,
ALL_LAYERS_STRESS_INPUT,
CURRENT_SCHEMA_VERSION,
DEFAULT_CONFIGS,
LAYER_FIELD_SPECS,
LAYER_ORDER,
SAFETY_CAPS,
emptyAuraState,
inCanonicalOrder,
normalizeAuraState,
type LayerType,
} from "../src/index";

const ALL_LAYERS=Object.keys(DEFAULT_CONFIGS) as LayerType[];

describe("field spec table", () => {
it("covers exactly the 21 layer types the renderer knows", () => {
expect(ALL_LAYERS).toHaveLength(21);
expect(Object.keys(LAYER_FIELD_SPECS).sort()).toEqual([...ALL_LAYERS].sort());
});

it("covers every field of every layer, with no extras", () => {
const problems: string[]=[];
for(const layer of ALL_LAYERS){
const actual=Object.keys(DEFAULT_CONFIGS[layer]).sort();
const spec=Object.keys(LAYER_FIELD_SPECS[layer]).sort();
for(const f of actual){
if(!spec.includes(f)) problems.push(`${layer}.${f} exists in the renderer but not in the spec table`);
}
for(const f of spec){
if(!actual.includes(f)) problems.push(`${layer}.${f} is in the spec table but not in the renderer`);
}
}
expect(problems).toEqual([]);
});

it("gives every spec default a value the spec itself accepts", () => {
const problems: string[]=[];
for(const layer of ALL_LAYERS){
for(const [field, spec] of Object.entries(LAYER_FIELD_SPECS[layer])){
if(spec.kind === "number"){
if(spec.default < spec.min || spec.default > spec.max){
problems.push(`${layer}.${field} default ${spec.default} is outside ${spec.min} to ${spec.max}`);
}
}else if(spec.kind === "enum"){
if(!spec.values.includes(spec.default)){
problems.push(`${layer}.${field} default ${spec.default} is not one of its own values`);
}
}else if(spec.kind === "color"){
if(!/^#[0-9a-fA-F]{6}$/.test(spec.default)){
problems.push(`${layer}.${field} default ${spec.default} is not a #RRGGBB color`);
}
}
}
}
expect(problems).toEqual([]);
});

it("agrees with the renderer about every default value", () => {
const problems: string[]=[];
for(const layer of ALL_LAYERS){
const defaults=DEFAULT_CONFIGS[layer] as unknown as Record<string, unknown>;
for(const [field, spec] of Object.entries(LAYER_FIELD_SPECS[layer])){
if(spec.kind === "list" || spec.kind === "polylines") continue;
if(defaults[field] !== spec.default){
problems.push(
`${layer}.${field}: renderer default ${JSON.stringify(defaults[field])} ` +
`but spec table says ${JSON.stringify(spec.default)}`,
);
}
}
}
expect(problems).toEqual([]);
});
});

describe("safety caps", () => {
it.each(SAFETY_CAPS)("keeps $layer.$field capped at $max", ({ layer, field, max }) => {
const spec=LAYER_FIELD_SPECS[layer][field];
expect(spec).toBeDefined();
expect(spec!.kind).toBe("number");
if(spec!.kind === "number") expect(spec!.max).toBeLessThanOrEqual(max);
});

it.each(SAFETY_CAPS)(
"clamps a dangerous $field no matter how it is spelled",
({ layer, field, max }) => {
for(const attempt of [1e9, "99999", max * 10, Number.MAX_SAFE_INTEGER]){
const { state, warnings }=normalizeAuraState({
layers: [{ type: layer, config: { [field]: attempt } }],
});
const config=state.layers[0]!.config as unknown as Record<string, number>;
expect(config[field]).toBeLessThanOrEqual(max);
expect(warnings.some((w) => w.kind === "clamped" && w.path === `${layer}.${field}`)).toBe(true);
}
},
);
});

describe("normalizeAuraState", () => {
it("never throws, whatever it is handed", () => {
const nasty: unknown[]=[
null,
undefined,
0,
"",
"not json",
[],
{ layers: "nope" },
{ layers: [null, 3, "x", {}] },
{ layers: [{ type: "visual_snow", config: null }] },
{ schemaVersion: "banana", layers: [{ type: 123 }] },
{ layers: [{ type: "visual_snow", config: { density: NaN } }] },
{ layers: [{ type: "visual_snow", config: { density: Infinity } }] },
{ background: 42 },
];
for(const input of nasty){
expect(() => normalizeAuraState(input)).not.toThrow();
const { state }=normalizeAuraState(input);
expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
expect(Array.isArray(state.layers)).toBe(true);
}
});

it("rejects unknown layers and says so", () => {
const { state, warnings }=normalizeAuraState({
layers: [
{ type: "visual_snow", config: {} },
{ type: "telepathy", config: {} },
{ type: "kaleidoscope_mode", config: {} },
],
});
expect(state.layers.map((l) => l.type)).toEqual(["visual_snow"]);
expect(warnings.filter((w) => w.kind === "unknown_layer")).toHaveLength(2);
});

it("drops unknown fields inside a known layer", () => {
const { state, warnings }=normalizeAuraState({
layers: [{ type: "visual_snow", config: { density: 500, sparkliness: 11 } }],
});
expect(state.layers[0]!.config).not.toHaveProperty("sparkliness");
expect(warnings.some((w) => w.kind === "unknown_field" && w.path === "visual_snow.sparkliness")).toBe(true);
});

it("keeps only the first of a duplicated layer", () => {
const { state, warnings }=normalizeAuraState({
layers: [
{ type: "scotoma", opacity: 0.25 },
{ type: "scotoma", opacity: 0.9 },
],
});
expect(state.layers).toHaveLength(1);
expect(state.layers[0]!.opacity).toBe(0.25);
expect(warnings.some((w) => w.kind === "duplicate_layer")).toBe(true);
});

it("fills every missing field with the renderer's default", () => {
const { state }=normalizeAuraState({ layers: [{ type: "visual_snow", config: {} }] });
expect(state.layers[0]!.config).toEqual(DEFAULT_CONFIGS.visual_snow);
});

it("accepts numeric strings and loose booleans, the way models emit them", () => {
const { state }=normalizeAuraState({
layers: [{ type: "visual_snow", config: { density: "4200", color_noise: "true" } }],
});
const config=state.layers[0]!.config as { density: number; color_noise: boolean };
expect(config.density).toBe(4200);
expect(config.color_noise).toBe(true);
});

it("normalizes sloppy colors and rejects impossible ones", () => {
const { state }=normalizeAuraState({
layers: [{ type: "scotoma", config: { fill_color: "abc", border_color: "chartreuse" } }],
});
const config=state.layers[0]!.config as { fill_color: string; border_color: string };
expect(config.fill_color).toBe("#aabbcc");
expect(config.border_color).toBe(DEFAULT_CONFIGS.scotoma.border_color);
});

it("rounds fields declared as integers", () => {
const { state }=normalizeAuraState({
layers: [{ type: "eye_floaters", config: { count: 7.8 } }],
});
expect((state.layers[0]!.config as { count: number }).count).toBe(8);
});

it("truncates over-long lists rather than accepting them", () => {
const points=Array.from({ length: 40 }, (_, i) => ({ x: i / 40, y: 0.5 }));
const { state, warnings }=normalizeAuraState({
layers: [{ type: "photopsia_flashes", config: { flash_points: points } }],
});
expect((state.layers[0]!.config as { flash_points: unknown[] }).flash_points).toHaveLength(20);
expect(warnings.some((w) => w.kind === "list_truncated")).toBe(true);
});

it("refuses a remote photo background, because the renderer may not touch the network", () => {
const { state, warnings }=normalizeAuraState({
layers: [],
background: { background_type: "photo", photo_uri: "https://example.com/tracker.png" },
});
expect(state.background.background_type).toBe("neutral");
expect(state.background.photo_uri).toBeNull();
expect(warnings.some((w) => w.path === "background.photo_uri")).toBe(true);
});

it("accepts a data URL photo background", () => {
const uri="data:image/png;base64,iVBORw0KGgo=";
const { state }=normalizeAuraState({
layers: [],
background: { background_type: "photo", photo_uri: uri },
});
expect(state.background).toEqual({ background_type: "photo", photo_uri: uri });
});

it("migrates a PAWOI-era custom background to a photo background", () => {
const uri="data:image/png;base64,iVBORw0KGgo=";
const { state, warnings }=normalizeAuraState({
layers: [],
background: { background_type: "custom", background_custom_url: uri },
});
expect(state.background.background_type).toBe("photo");
expect(state.background.photo_uri).toBe(uri);
expect(warnings.some((w) => w.kind === "schema_upgraded")).toBe(true);
});

it("warns, but still renders, when the file is from a newer schema", () => {
const { state, warnings }=normalizeAuraState({
schemaVersion: CURRENT_SCHEMA_VERSION + 5,
layers: [{ type: "visual_snow" }],
});
expect(state.layers).toHaveLength(1);
expect(warnings.some((w) => w.kind === "schema_upgraded" && w.path === "schemaVersion")).toBe(true);
});

it("does not warn about a missing master opacity, which is the normal case", () => {
const { warnings }=normalizeAuraState({ layers: [{ type: "visual_snow", config: DEFAULT_CONFIGS.visual_snow }] });
expect(warnings).toEqual([]);
});
});

describe("round trip", () => {
it("is stable: normalizing twice changes nothing the second time", () => {
for(const preset of AURA_PRESETS){
const once=normalizeAuraState({ schemaVersion: 1, ...preset.input });
const twice=normalizeAuraState(once.state);
expect(twice.state).toEqual(once.state);
expect(twice.warnings).toEqual([]);
}
});

it("survives a JSON round trip, which is how auras are stored and bridged", () => {
const { state }=normalizeAuraState({ schemaVersion: 1, ...ALL_LAYERS_STRESS_INPUT });
expect(state.layers).toHaveLength(21);
const revived=normalizeAuraState(JSON.parse(JSON.stringify(state)));
expect(revived.state).toEqual(state);
expect(revived.warnings).toEqual([]);
});
});

describe("starter presets", () => {
it("every preset normalizes with no warnings beyond filled-in defaults", () => {
for(const preset of AURA_PRESETS){
const { state, warnings }=normalizeAuraState({ schemaVersion: 1, ...preset.input });
expect(state.layers.length).toBeGreaterThan(0);
const unexpected=warnings.filter((w) => w.kind !== "missing_field");
expect({ preset: preset.id, unexpected }).toEqual({ preset: preset.id, unexpected: [] });
}
});

it("has a unique id and a plain description for each", () => {
const ids=AURA_PRESETS.map((p) => p.id);
expect(new Set(ids).size).toBe(ids.length);
for(const p of AURA_PRESETS){
expect(p.name.length).toBeGreaterThan(0);
expect(p.description.length).toBeGreaterThan(0);
expect(p.description).not.toMatch(/!/);
}
});
});

describe("canonical order", () => {
it("sorts layers into the renderer's documented compositing order", () => {
const { state }=normalizeAuraState({
layers: [{ type: "oscillopsia" }, { type: "visual_snow" }, { type: "scotoma" }],
});
const sorted=inCanonicalOrder(state.layers).map((l) => l.type);
expect(sorted).toEqual(["visual_snow", "scotoma", "oscillopsia"]);
});

it("LAYER_ORDER lists all 21 layers exactly once", () => {
expect(LAYER_ORDER).toHaveLength(21);
expect(new Set(LAYER_ORDER).size).toBe(21);
});
});

describe("emptyAuraState", () => {
it("is a valid, renderable, empty aura on the dark field", () => {
const empty=emptyAuraState();
expect(empty.layers).toEqual([]);
expect(empty.background.background_type).toBe("neutral");
expect(normalizeAuraState(empty).warnings).toEqual([]);
});
});
