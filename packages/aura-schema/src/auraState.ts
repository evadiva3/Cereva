
import {
LAYER_FIELD_SPECS,
type FieldSpec,
type LeafSpec,
} from "./fieldSpecs";
import {
LAYER_ORDER,
type LayerType,
type SymptomLayer,
} from "./layers";
import {
DEFAULT_BACKGROUND,
type BackgroundConfig,
type BackgroundType,
} from "./background";

export const CURRENT_SCHEMA_VERSION=1;

export interface AuraState {
schemaVersion: number;
layers: SymptomLayer[];
background: BackgroundConfig;
}

export type WarningKind =
| "unknown_layer"
| "duplicate_layer"
| "unknown_field"
| "missing_field"
| "wrong_type"
| "clamped"
| "list_truncated"
| "schema_upgraded"
| "malformed_input";

export interface Warning {
kind: WarningKind;
path: string;
message: string;
received?: unknown;
used?: unknown;
}

export interface NormalizeResult {
state: AuraState;
warnings: Warning[];
}

const BACKGROUND_TYPES: readonly BackgroundType[]=[
"neutral",
"photo",
"camera",
"reading_passage",
];

const HEX_COLOR=/^#[0-9a-fA-F]{6}$/;

function isRecord(v: unknown): v is Record<string, unknown> {
return typeof v === "object" && v !== null && !Array.isArray(v);
}

function leaf(
spec: LeafSpec,
raw: unknown,
path: string,
warn: (w: Warning) => void,
): unknown {
const present=raw !== undefined && raw !== null;

if(!present){
warn({
kind: "missing_field",
path,
message: `missing, using the default ${JSON.stringify(spec.default)}`,
used: spec.default,
});
return spec.default;
}

switch(spec.kind){
case "number": {
const asNum=typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
if(!Number.isFinite(asNum)){
warn({
kind: "wrong_type",
path,
message: `expected a number, using the default ${spec.default}`,
received: raw,
used: spec.default,
});
return spec.default;
}
let v=asNum;
if(spec.int) v = Math.round(v);
const clamped=Math.min(spec.max, Math.max(spec.min, v));
if(clamped !== v){
warn({
kind: "clamped",
path,
message: `${v} is outside ${spec.min} to ${spec.max}, clamped to ${clamped}`,
received: v,
used: clamped,
});
}
return clamped;
}

case "bool": {
if(typeof raw === "boolean") return raw;
if(raw === "true" || raw === 1) return true;
if(raw === "false" || raw === 0) return false;
warn({
kind: "wrong_type",
path,
message: `expected true or false, using the default ${spec.default}`,
received: raw,
used: spec.default,
});
return spec.default;
}

case "enum": {
if(typeof raw === "string" && spec.values.includes(raw)) return raw;
warn({
kind: "wrong_type",
path,
message:
`expected one of ${spec.values.join(", ")}, ` +
`using the default ${spec.default}`,
received: raw,
used: spec.default,
});
return spec.default;
}

case "color": {
if(typeof raw === "string"){
let s=raw.trim();
if(!s.startsWith("#")) s = "#" + s;
if(/^#[0-9a-fA-F]{3}$/.test(s)){
s="#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
}
if(HEX_COLOR.test(s)){
if(s.toLowerCase() !== raw.toLowerCase()){
warn({
kind: "wrong_type",
path,
message: `color ${raw} normalized to ${s}`,
received: raw,
used: s,
});
}
return s;
}
}
warn({
kind: "wrong_type",
path,
message: `expected a #RRGGBB color, using the default ${spec.default}`,
received: raw,
used: spec.default,
});
return spec.default;
}
}
}

function field(
spec: FieldSpec,
raw: unknown,
path: string,
warn: (w: Warning) => void,
): unknown {
if(spec.kind === "list"){
if(raw === undefined || raw === null){
warn({
kind: "missing_field",
path,
message: "missing, using the default entries",
used: spec.default,
});
return spec.default.map((d) => ({ ...d }));
}
if(!Array.isArray(raw)){
warn({
kind: "wrong_type",
path,
message: "expected a list, using the default entries",
received: raw,
used: spec.default,
});
return spec.default.map((d) => ({ ...d }));
}
let items=raw;
if(items.length > spec.maxItems){
warn({
kind: "list_truncated",
path,
message: `${items.length} entries exceeds the maximum of ${spec.maxItems}, extra entries dropped`,
received: items.length,
used: spec.maxItems,
});
items=items.slice(0, spec.maxItems);
}
const out=items.map((item, i) => {
const itemPath=`${path}[${i}]`;
const src=isRecord(item) ? item : {};
if(!isRecord(item)){
warn({
kind: "wrong_type",
path: itemPath,
message: "expected an object, using defaults for every field",
received: item,
});
}
const obj: Record<string, unknown>={};
for(const [key, leafSpec] of Object.entries(spec.of)){
obj[key]=leaf(leafSpec, src[key], `${itemPath}.${key}`, warn);
}
for(const key of Object.keys(src)){
if(!(key in spec.of)){
warn({
kind: "unknown_field",
path: `${itemPath}.${key}`,
message: "not part of the schema, dropped",
received: src[key],
});
}
}
return obj;
});
if(out.length < spec.minItems){
warn({
kind: "missing_field",
path,
message: `fewer than the minimum ${spec.minItems} entries, using the defaults`,
used: spec.default,
});
return spec.default.map((d) => ({ ...d }));
}
return out;
}

if(spec.kind === "polylines"){
if(raw === undefined || raw === null) return [];
if(!Array.isArray(raw)){
warn({
kind: "wrong_type",
path,
message: "expected a list of drawn shapes, using none",
received: raw,
used: [],
});
return [];
}
let shapes=raw;
if(shapes.length > spec.maxShapes){
warn({
kind: "list_truncated",
path,
message: `${shapes.length} shapes exceeds the maximum of ${spec.maxShapes}, extra shapes dropped`,
received: shapes.length,
used: spec.maxShapes,
});
shapes=shapes.slice(0, spec.maxShapes);
}
const out: Array<Array<[number, number]>>=[];
shapes.forEach((shape, i) => {
const sp=`${path}[${i}]`;
if(!Array.isArray(shape)){
warn({ kind: "wrong_type", path: sp, message: "expected a list of points, dropped", received: shape });
return;
}
const pts: Array<[number, number]>=[];
for(const p of shape){
if(
Array.isArray(p) &&
p.length >= 2 &&
Number.isFinite(Number(p[0])) &&
Number.isFinite(Number(p[1]))
){
pts.push([
Math.min(1, Math.max(0, Number(p[0]))),
Math.min(1, Math.max(0, Number(p[1]))),
]);
}
}
if(pts.length < spec.minPoints){
warn({
kind: "wrong_type",
path: sp,
message: `${pts.length} usable points is below the minimum of ${spec.minPoints}, shape dropped`,
received: pts.length,
});
return;
}
out.push(pts.slice(0, spec.maxPoints));
});
return out;
}

return leaf(spec, raw, path, warn);
}

function normalizeBackground(raw: unknown, warn: (w: Warning) => void): BackgroundConfig {
if(!isRecord(raw)){
if(raw !== undefined){
warn({
kind: "wrong_type",
path: "background",
message: "expected an object, using the dark field",
received: raw,
used: DEFAULT_BACKGROUND,
});
}
return { ...DEFAULT_BACKGROUND };
}

const t=raw.background_type;
let background_type: BackgroundType;
if(typeof t === "string" && (BACKGROUND_TYPES as readonly string[]).includes(t)){
background_type=t as BackgroundType;
}else{
if(t === "custom"){
background_type="photo";
warn({
kind: "schema_upgraded",
path: "background.background_type",
message: 'PAWOI "custom" background mapped to "photo"',
received: t,
used: background_type,
});
}else{
background_type=DEFAULT_BACKGROUND.background_type;
if(t !== undefined){
warn({
kind: "wrong_type",
path: "background.background_type",
message: `unknown background, using ${background_type}`,
received: t,
used: background_type,
});
}
}
}

let photo_uri: string | null=null;
if(background_type === "photo"){
const u=raw.photo_uri ?? raw.background_custom_url;
if(typeof u === "string" && u.length > 0){
if(/^(data:|file:|blob:|\/)/i.test(u)){
photo_uri=u;
}else{
warn({
kind: "wrong_type",
path: "background.photo_uri",
message: "only data, file and blob URIs are allowed, falling back to the dark field",
received: u,
});
background_type="neutral";
}
}else{
warn({
kind: "missing_field",
path: "background.photo_uri",
message: "photo background has no image, falling back to the dark field",
});
background_type="neutral";
}
}

return { background_type, photo_uri };
}

export function normalizeAuraState(input: unknown): NormalizeResult {
const warnings: Warning[]=[];
const warn=(w: Warning) => warnings.push(w);

if(!isRecord(input)){
warn({
kind: "malformed_input",
path: "",
message: "not an object, returning an empty aura on the dark field",
received: input,
});
return {
state: {
schemaVersion: CURRENT_SCHEMA_VERSION,
layers: [],
background: { ...DEFAULT_BACKGROUND },
},
warnings,
};
}

const rawVersion=input.schemaVersion;
if(typeof rawVersion === "number" && Number.isFinite(rawVersion)){
if(rawVersion > CURRENT_SCHEMA_VERSION){
warn({
kind: "schema_upgraded",
path: "schemaVersion",
message:
`this aura was saved by a newer version (${rawVersion} against ${CURRENT_SCHEMA_VERSION}); ` +
"anything this build does not recognize has been dropped",
received: rawVersion,
used: CURRENT_SCHEMA_VERSION,
});
}else if(rawVersion < CURRENT_SCHEMA_VERSION){
warn({
kind: "schema_upgraded",
path: "schemaVersion",
message: `upgraded from schema version ${rawVersion} to ${CURRENT_SCHEMA_VERSION}`,
received: rawVersion,
used: CURRENT_SCHEMA_VERSION,
});
}
}else if(rawVersion !== undefined){
warn({
kind: "wrong_type",
path: "schemaVersion",
message: `expected a number, treating as version ${CURRENT_SCHEMA_VERSION}`,
received: rawVersion,
used: CURRENT_SCHEMA_VERSION,
});
}

const rawLayers=input.layers;
const layers: SymptomLayer[]=[];
const seen=new Set<string>();

if(Array.isArray(rawLayers)){
for(let i = 0; i < rawLayers.length; i++){
const rawLayer=rawLayers[i];
if(!isRecord(rawLayer)){
warn({
kind: "wrong_type",
path: `layers[${i}]`,
message: "expected an object, dropped",
received: rawLayer,
});
continue;
}
const type=rawLayer.type;
if(typeof type !== "string" || !(type in LAYER_FIELD_SPECS)){
warn({
kind: "unknown_layer",
path: `layers[${i}]`,
message: `"${String(type)}" is not a layer this app knows, dropped`,
received: type,
});
continue;
}
const layerType=type as LayerType;
if(seen.has(layerType)){
warn({
kind: "duplicate_layer",
path: `layers[${i}]`,
message: `${layerType} appears more than once, only the first is kept`,
received: layerType,
});
continue;
}
seen.add(layerType);

const specs=LAYER_FIELD_SPECS[layerType];
const rawConfig=isRecord(rawLayer.config) ? rawLayer.config : {};
if(!isRecord(rawLayer.config)){
warn({
kind: "missing_field",
path: `${layerType}.config`,
message: "no config, using defaults for every field",
});
}

const config: Record<string, unknown>={};
for(const [key, spec] of Object.entries(specs)){
config[key]=field(spec, rawConfig[key], `${layerType}.${key}`, warn);
}
for(const key of Object.keys(rawConfig)){
if(!(key in specs)){
warn({
kind: "unknown_field",
path: `${layerType}.${key}`,
message: "not part of this layer's schema, dropped",
received: rawConfig[key],
});
}
}

layers.push({
id: layerType,
type: layerType,
visible:
typeof rawLayer.visible === "boolean"
? rawLayer.visible
: rawLayer.visible === undefined
? true
: !!rawLayer.visible,
opacity: leaf(
{ kind: "number", min: 0, max: 1, default: 1, label: "Opacity" },
rawLayer.opacity,
`${layerType}.opacity`,
(w) => {
if(w.kind !== "missing_field") warn(w);
},
) as number,
config,
} as unknown as SymptomLayer);
}
}else if(rawLayers !== undefined){
warn({
kind: "wrong_type",
path: "layers",
message: "expected a list, using no layers",
received: rawLayers,
});
}

return {
state: {
schemaVersion: CURRENT_SCHEMA_VERSION,
layers,
background: normalizeBackground(input.background, warn),
},
warnings,
};
}

export function inCanonicalOrder(layers: SymptomLayer[]): SymptomLayer[] {
const rank=new Map<LayerType, number>(LAYER_ORDER.map((t, i) => [t, i]));
return [...layers].sort(
(a, b) => (rank.get(a.type) ?? 0) - (rank.get(b.type) ?? 0),
);
}

export function emptyAuraState(): AuraState {
return {
schemaVersion: CURRENT_SCHEMA_VERSION,
layers: [],
background: { ...DEFAULT_BACKGROUND },
};
}
