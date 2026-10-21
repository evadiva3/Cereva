
import { SimulatorEngine } from "./canvas/engine";
import { CameraSource } from "./canvas/backgrounds/camera";
import { supportsCanvasFilter } from "./canvas/types";
import {
BRIDGE_VERSION,
CURRENT_SCHEMA_VERSION,
envelope,
normalizeAuraState,
parseHostMessage,
LAYER_FIELD_SPECS,
type Envelope,
type ErrorCode,
type HostMessage,
type RendererMessage,
} from "../../packages/aura-schema/src/index";

const COMPOSITE_READING_LAYERS=[
"afterimage_trail",
"alice_in_wonderland",
"color_distortion",
"edge_glow",
"hemianopia_mask",
"metamorphopsia",
"oscillopsia",
"palinopsia",
"photophobia",
"retinal_afterimage",
"text_blur",
"tunnel_vision",
];

declare global {
interface Window {
ReactNativeWebView?: { postMessage(data: string): void };
scintilla?: {
send(message: unknown): void;
engine: SimulatorEngine;
};
}
}

let seq=0;
const nextId=() => `r${++seq}`;

function post(body: RendererMessage, replyTo?: string): void {
const text=JSON.stringify(envelope(nextId(), body, replyTo));
if(window.ReactNativeWebView){
window.ReactNativeWebView.postMessage(text);
}else{
console.log("[renderer -> host]", text);
}
}

function postError(code: ErrorCode, message: string, replyTo?: string, detail?: string): void {
post(detail === undefined ? { type: "error", code, message } : { type: "error", code, message, detail }, replyTo);
}

function detectWebgl2(): boolean {
try {
const probe=document.createElement("canvas");
return !!probe.getContext("webgl2");
}catch {
return false;
}
}

function boot(): void {
const canvas=document.getElementById("stage") as HTMLCanvasElement | null;
if(!canvas){
postError("render_fault", "the canvas element is missing from the bundle");
return;
}

let engine: SimulatorEngine;
try {
engine=new SimulatorEngine(canvas);
}catch(err){
postError("render_fault", "could not get a 2D context", undefined, String(err));
return;
}

const camera=new CameraSource();
engine.setCamera(camera);

const fit=() => {
const w=document.documentElement.clientWidth || window.innerWidth;
const h=document.documentElement.clientHeight || window.innerHeight;
engine.resize(w, h);
};
fit();
if(typeof ResizeObserver !== "undefined"){
new ResizeObserver(fit).observe(document.documentElement);
}else{
window.addEventListener("resize", fit);
}

const touchPoint=(e: TouchEvent) => {
const t=e.touches[0];
if(!t) return;
const r=canvas.getBoundingClientRect();
engine.setPointer(t.clientX - r.left, t.clientY - r.top);
};
canvas.addEventListener("touchstart", touchPoint, { passive: true });
canvas.addEventListener("touchmove", touchPoint, { passive: true });
canvas.addEventListener("touchend", () => engine.clearPointer(), { passive: true });
canvas.addEventListener("mousemove", (e) => {
const r=canvas.getBoundingClientRect();
engine.setPointer(e.clientX - r.left, e.clientY - r.top);
});
canvas.addEventListener("mouseleave", () => engine.clearPointer());

const handle=(msg: Envelope<HostMessage>): void => {
const body=msg.body;
switch(body.type){
case "setState": {
const { state, warnings }=normalizeAuraState(body.state);
engine.setLayers(state.layers);
engine.setBackground(state.background);
if(state.background.background_type === "camera"){
void camera.start().then((report) => post({ type: "camera", report }));
}else if(camera.isLive()){
camera.stop();
}
post({ type: "accepted", warnings, layerCount: state.layers.length }, msg.id);
return;
}

case "setBackground": {
const { state, warnings }=normalizeAuraState({ background: body.background, layers: [] });
engine.setBackground(state.background);
if(state.background.background_type === "camera"){
void camera.start().then((report) => post({ type: "camera", report }));
}else if(camera.isLive()){
camera.stop();
}
post({ type: "accepted", warnings, layerCount: -1 }, msg.id);
return;
}

case "setMotion": {
if(body.pointer){
engine.setPointer(body.pointer.x, body.pointer.y);
}else{
engine.clearPointer();
}
return;
}

case "setQuality": {
if(body.maxDpr !== undefined) engine.setMaxDpr(body.maxDpr);
if(body.depthOfField !== undefined) engine.setDepthOfField(body.depthOfField);
return;
}

case "requestSnapshot": {
try {
const dataUrl=canvas.toDataURL("image/png");
post(
{ type: "snapshot", dataUrl, width: canvas.width, height: canvas.height },
msg.id,
);
}catch(err){
postError("snapshot_failed", "could not read the canvas", msg.id, String(err));
}
return;
}

case "startCamera": {
void camera.start().then((report) => post({ type: "camera", report }, msg.id));
return;
}

case "stopCamera": {
camera.stop();
post({ type: "camera", report: camera.diagnostics() }, msg.id);
return;
}

case "requestStats": {
post({ type: "stats", stats: engine.stats() }, msg.id);
return;
}

case "resetStats": {
engine.resetStats();
post({ type: "stats", stats: engine.stats() }, msg.id);
return;
}

case "ping": {
post({ type: "pong" }, msg.id);
return;
}
}
};

const receive=(raw: unknown) => {
const parsed=parseHostMessage(raw);
if(!parsed.ok){
postError(parsed.code, parsed.message, parsed.id);
return;
}
try {
handle(parsed.value);
}catch(err){
postError("render_fault", "handler threw", parsed.value.id, String(err));
}
};

document.addEventListener("message", (e) => receive((e as MessageEvent).data));
window.addEventListener("message", (e) => receive((e as MessageEvent).data));

window.scintilla={ send: receive, engine };

engine.start();

post({
type: "ready",
bridgeVersion: BRIDGE_VERSION,
schemaVersion: CURRENT_SCHEMA_VERSION,
capabilities: {
layers: Object.keys(LAYER_FIELD_SPECS),
webgl2: detectWebgl2(),
canvasFilter: supportsCanvasFilter(),
compositeReadingLayers: COMPOSITE_READING_LAYERS,
},
});
}

if(document.readyState === "loading"){
document.addEventListener("DOMContentLoaded", boot);
}else{
boot();
}
