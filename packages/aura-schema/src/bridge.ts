
import type { AuraState, Warning } from "./auraState";
import type { BackgroundConfig } from "./background";

export const BRIDGE_VERSION=1;

export type HostMessage =
| { type: "setState"; state: unknown }
| { type: "setBackground"; background: unknown }
| { type: "setMotion"; pointer: { x: number; y: number } | null }
| { type: "setQuality"; maxDpr?: number; depthOfField?: boolean }
| { type: "requestSnapshot"; scale?: number }
| { type: "startCamera" }
| { type: "stopCamera" }
| { type: "requestStats" }
| { type: "resetStats" }
| { type: "ping" };

export interface RendererCapabilities {
layers: string[];
webgl2: boolean;
canvasFilter: boolean;
compositeReadingLayers: string[];
}

export interface CameraReport {
status: string;
mediaDevicesPresent: boolean;
secureContext: boolean;
origin: string;
errorName: string | null;
errorMessage: string | null;
videoWidth: number;
videoHeight: number;
}

export interface FrameStats {
fpsMedian: number;
fpsLow: number;
frameCount: number;
activeLayers: number;
dpr: number;
deviceDpr: number;
widthCss: number;
heightCss: number;
}

export type RendererMessage =
| { type: "ready"; bridgeVersion: number; schemaVersion: number; capabilities: RendererCapabilities }
| { type: "error"; code: ErrorCode; message: string; detail?: string }
| { type: "accepted"; warnings: Warning[]; layerCount: number }
| { type: "snapshot"; dataUrl: string; width: number; height: number }
| { type: "stats"; stats: FrameStats }
| { type: "camera"; report: CameraReport }
| { type: "pong" };

export type ErrorCode =
| "bad_envelope"
| "version_mismatch"
| "unknown_type"
| "bad_payload"
| "render_fault"
| "snapshot_failed"
| "camera_failed";

export interface Envelope<T> {
v: number;
id: string;
replyTo?: string;
body: T;
}

export function envelope<T>(id: string, body: T, replyTo?: string): Envelope<T> {
return replyTo === undefined
? { v: BRIDGE_VERSION, id, body }
: { v: BRIDGE_VERSION, id, body, replyTo };
}

export type ParseOutcome<T> =
| { ok: true; value: Envelope<T> }
| { ok: false; code: ErrorCode; message: string; id?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseEnvelope(raw: unknown): ParseOutcome<unknown> {
let data: unknown=raw;
if(typeof raw === "string"){
try {
data=JSON.parse(raw);
}catch {
return { ok: false, code: "bad_envelope", message: "not valid JSON" };
}
}
if(!isRecord(data)){
return { ok: false, code: "bad_envelope", message: "not an object" };
}
const id=typeof data.id === "string" ? data.id : undefined;
const withId=id === undefined ? {} : { id };
if(typeof data.v !== "number"){
return { ok: false, code: "bad_envelope", message: "missing version field v", ...withId };
}
if(data.v !== BRIDGE_VERSION){
return {
ok: false,
code: "version_mismatch",
message:
`bridge version ${data.v} cannot talk to version ${BRIDGE_VERSION}. ` +
"The app and the bundled renderer are out of step, which means the " +
"renderer bundle needs rebuilding.",
...withId,
};
}
if(id === undefined){
return { ok: false, code: "bad_envelope", message: "missing or non-string id" };
}
if(!isRecord(data.body) || typeof data.body.type !== "string"){
return { ok: false, code: "bad_envelope", message: "body must be an object with a type", id };
}
const out: Envelope<unknown>={ v: data.v, id, body: data.body };
if(typeof data.replyTo === "string") out.replyTo = data.replyTo;
return { ok: true, value: out };
}

const HOST_TYPES=new Set<HostMessage["type"]>([
"setState",
"setBackground",
"setMotion",
"setQuality",
"requestSnapshot",
"startCamera",
"stopCamera",
"requestStats",
"resetStats",
"ping",
]);

const RENDERER_TYPES=new Set<RendererMessage["type"]>([
"ready",
"error",
"accepted",
"snapshot",
"stats",
"camera",
"pong",
]);

export function parseHostMessage(raw: unknown): ParseOutcome<HostMessage> {
const outer=parseEnvelope(raw);
if(!outer.ok) return outer;
const body=outer.value.body as Record<string, unknown>;
const type=body.type as HostMessage["type"];
if(!HOST_TYPES.has(type)){
return {
ok: false,
code: "unknown_type",
message: `the renderer has no handler for "${String(type)}"`,
id: outer.value.id,
};
}

const isRealNumber=(v: unknown): v is number =>
typeof v === "number" && Number.isFinite(v);

if(type === "setMotion"){
const p=body.pointer;
if(p !== null && p !== undefined){
if(!isRecord(p) || !isRealNumber(p.x) || !isRealNumber(p.y)){
return {
ok: false,
code: "bad_payload",
message: "setMotion needs pointer to be null or {x, y} finite numbers",
id: outer.value.id,
};
}
}
}

if(type === "setQuality"){
if(body.maxDpr !== undefined && !isRealNumber(body.maxDpr)){
return {
ok: false,
code: "bad_payload",
message: "setQuality maxDpr must be a finite number",
id: outer.value.id,
};
}
if(body.depthOfField !== undefined && typeof body.depthOfField !== "boolean"){
return {
ok: false,
code: "bad_payload",
message: "setQuality depthOfField must be a boolean",
id: outer.value.id,
};
}
}

if(type === "requestSnapshot" && body.scale !== undefined){
const s=body.scale;
if(!isRealNumber(s) || s <= 0 || s > 4){
return {
ok: false,
code: "bad_payload",
message: "requestSnapshot scale must be between 0 and 4",
id: outer.value.id,
};
}
}

return { ok: true, value: outer.value as Envelope<HostMessage> };
}

export function parseRendererMessage(raw: unknown): ParseOutcome<RendererMessage> {
const outer=parseEnvelope(raw);
if(!outer.ok) return outer;
const body=outer.value.body as Record<string, unknown>;
const type=body.type as RendererMessage["type"];
if(!RENDERER_TYPES.has(type)){
return {
ok: false,
code: "unknown_type",
message: `the app has no handler for "${String(type)}"`,
id: outer.value.id,
};
}

if(type === "ready"){
if(body.bridgeVersion !== BRIDGE_VERSION){
return {
ok: false,
code: "version_mismatch",
message: `renderer reports bridge version ${String(body.bridgeVersion)}, app speaks ${BRIDGE_VERSION}`,
id: outer.value.id,
};
}
if(!isRecord(body.capabilities) || !Array.isArray(body.capabilities.layers)){
return {
ok: false,
code: "bad_payload",
message: "ready must carry capabilities.layers",
id: outer.value.id,
};
}
}

if(type === "snapshot"){
const u=body.dataUrl;
if(typeof u !== "string" || !u.startsWith("data:image/")){
return {
ok: false,
code: "bad_payload",
message: "snapshot dataUrl must be a data:image URL",
id: outer.value.id,
};
}
}

if(type === "accepted" && !Array.isArray(body.warnings)){
return {
ok: false,
code: "bad_payload",
message: "accepted must carry a warnings array",
id: outer.value.id,
};
}

return { ok: true, value: outer.value as Envelope<RendererMessage> };
}

export type { AuraState, BackgroundConfig, Warning };
