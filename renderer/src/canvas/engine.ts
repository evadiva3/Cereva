import { BackgroundRenderer } from "./background";
import type { CameraSource } from "./backgrounds/camera";
import { createRenderer } from "./renderers";
import { supportsCanvasFilter, type FrameContext, type LayerRenderer } from "./types";
import type { BackgroundConfig, BackgroundType } from "../types/background";
import type { LayerType, SymptomLayer } from "../types/layers";
const MAX_DPR=2;
const MAX_DT_MS=100;
const FRAME_WINDOW=1800;
const HEAVY_STACK_THRESHOLD=8;
const LAYER_ZONE: Record<LayerType, "A" | "B" | "C">={
eye_floaters: "A",
photopsia_flashes: "A",
phosphene_burst: "A",
visual_snow: "B",
scotoma: "B",
migrating_scotoma: "B",
retinal_afterimage: "B", 
hemianopia_mask: "B",
tunnel_vision: "B",
text_blur: "B",
lexical_distortion: "B", 
fortification_spectra: "C",
geometric_aura: "C",
afterimage_trail: "C",
oscillopsia: "C",
alice_in_wonderland: "C",
metamorphopsia: "C",
color_distortion: "C",
palinopsia: "C",
photophobia: "C",
edge_glow: "C",
};
const ZONE_ORDER: Array<"A" | "B" | "C">=["C", "B", "A"];
const DEPTH_BLUR_PX: Partial<Record<LayerType, number>>={
photopsia_flashes: 0.8,
phosphene_burst: 0.8,
fortification_spectra: 1.2,
geometric_aura: 1.2,
};
const VIGNETTE_INNER=0.7;
const VIGNETTE_MAX_ALPHA=0.15;
export class SimulatorEngine {
private readonly canvas: HTMLCanvasElement;
private readonly ctx: CanvasRenderingContext2D;
private readonly layerPass: HTMLCanvasElement;
private readonly layerPassCtx: CanvasRenderingContext2D;
private readonly background = new BackgroundRenderer();
private renderers = new Map<string, LayerRenderer>();
private layers: SymptomLayer[] = [];
private widthCss = 0;
private heightCss = 0;
private dpr = 1;
private rafId = 0;
private running = false;
private startTime = 0;
private lastTime = 0;
private pointer: { x: number; y: number } | null = null;
private backgroundType: BackgroundType = "neutral";
private depthOfField = true;
private maxDpr = MAX_DPR;
private frameTimes: number[] = [];
private vignette: CanvasGradient | null = null;
private vignetteKey = "";

private warnedHeavyStack = false;
private faultedRenderers = new Set<string>();
private lastActiveCount = 0;
constructor(canvas: HTMLCanvasElement){
this.canvas=canvas;
const ctx=canvas.getContext("2d");
if(!ctx) throw new Error("Canvas 2D context unavailable");
this.ctx=ctx;
this.layerPass=document.createElement("canvas");
const passCtx=this.layerPass.getContext("2d");
if(!passCtx) throw new Error("Canvas 2D context unavailable");
this.layerPassCtx=passCtx;
}

setLayers(layers: SymptomLayer[]): void {
this.layers=layers;
const liveIds=new Set(layers.map((l) => l.id));
for(const [id, renderer] of this.renderers){
if(!liveIds.has(id as SymptomLayer["id"])){
renderer.dispose?.();
this.renderers.delete(id);
this.faultedRenderers.delete(id);
}
}
for(const layer of layers){
const existing=this.renderers.get(layer.id);
if(existing){
existing.update(layer.config);
}else{
this.renderers.set(layer.id, createRenderer(layer));
}
}
}
setBackground(config: BackgroundConfig): void {
this.backgroundType=config.background_type;
this.background.setConfig(config);
}
setDepthOfField(enabled: boolean): void {
this.depthOfField=enabled;
}
setCamera(camera: CameraSource | null): void {
this.background.setCamera(camera);
}
setMaxDpr(maxDpr: number): void {
const next=Math.max(1, Math.min(4, maxDpr));
if(next === this.maxDpr) return;
this.maxDpr=next;
if(this.widthCss > 0) this.resize(this.widthCss, this.heightCss);
}
stats(): {
fpsMedian: number;
fpsLow: number;
frameCount: number;
activeLayers: number;
dpr: number;
deviceDpr: number;
widthCss: number;
heightCss: number;
} {
const sorted=[...this.frameTimes].sort((a, b) => a - b);
const at=(q: number) =>
sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;
const msMedian=at(0.5);
const msSlow=at(0.95);
return {
fpsMedian: msMedian > 0 ? Math.round((1000 / msMedian) * 10) / 10 : 0,
fpsLow: msSlow > 0 ? Math.round((1000 / msSlow) * 10) / 10 : 0,
frameCount: sorted.length,
activeLayers: this.lastActiveCount,
dpr: this.dpr,
deviceDpr: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
widthCss: this.widthCss,
heightCss: this.heightCss,
};
}
resetStats(): void {
this.frameTimes=[];
}
resize(widthCss: number, heightCss: number): void {
this.widthCss=Math.max(1, Math.floor(widthCss));
this.heightCss=Math.max(1, Math.floor(heightCss));
this.dpr=Math.min(window.devicePixelRatio || 1, this.maxDpr);
this.canvas.width=Math.round(this.widthCss * this.dpr);
this.canvas.height=Math.round(this.heightCss * this.dpr);
this.layerPass.width=this.canvas.width;
this.layerPass.height=this.canvas.height;
}
setPointer(x: number, y: number): void {
this.pointer={ x, y };
}
clearPointer(): void {
this.pointer=null;
}
start(): void {
if(this.running) return;
this.running=true;
this.startTime=performance.now();
this.lastTime=this.startTime;
const loop=(now: number) => {
if(!this.running) return;
this.renderFrame(now);
this.rafId=requestAnimationFrame(loop);
};
this.rafId=requestAnimationFrame(loop);
}
stop(): void {
this.running=false;
cancelAnimationFrame(this.rafId);
}
dispose(): void {
this.stop();
for(const renderer of this.renderers.values()) renderer.dispose?.();
this.renderers.clear();
}
private renderFrame(now: number): void {
if(this.widthCss === 0 || this.heightCss === 0) return;
const rawDt=now - this.lastTime;
const dtMs=Math.min(rawDt, MAX_DT_MS);
this.lastTime=now;
if(rawDt >= 1){
this.frameTimes.push(rawDt);
if(this.frameTimes.length > FRAME_WINDOW) this.frameTimes.shift();
}
const ctx=this.ctx;
ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
this.background.draw(ctx, this.widthCss, this.heightCss, this.dpr);

const frame: FrameContext={
ctx: this.layerPassCtx,
canvas: this.layerPass,
width: this.widthCss,
height: this.heightCss,
dpr: this.dpr,
timeMs: now - this.startTime,
dtMs,
pointer: this.pointer,
backgroundType: this.backgroundType,
};

let postComposite: SymptomLayer | null=null;
let activeCount=0;
for(const layer of this.drawOrder()){
if(!layer.visible || layer.opacity <= 0) continue;
activeCount++;
if(layer.type === "oscillopsia"){
postComposite=layer;
continue;
}
const renderer=this.renderers.get(layer.id);
if(!renderer) continue;
const blurPx=this.depthOfField ? DEPTH_BLUR_PX[layer.type] : undefined;
this.safeRender(renderer, layer.id, frame, layer.opacity, blurPx);
}
if(postComposite){
const renderer=this.renderers.get(postComposite.id);
if(renderer){
this.safeRender(renderer, postComposite.id, frame, postComposite.opacity);
}
}
if(this.depthOfField){
this.drawVignette(ctx);
}
this.lastActiveCount=activeCount;
this.checkHeavyStack(activeCount);
}

private drawOrder(): SymptomLayer[] {
if(!this.depthOfField) return this.layers;
const zones: Record<"A" | "B" | "C", SymptomLayer[]>={ A: [], B: [], C: [] };
for(const layer of this.layers) zones[LAYER_ZONE[layer.type]].push(layer);
const ordered: SymptomLayer[]=[];
for(const zone of ZONE_ORDER) ordered.push(...zones[zone]);
return ordered;
}
private drawVignette(ctx: CanvasRenderingContext2D): void {
const w=this.widthCss;
const h=this.heightCss;
const key=`${w}x${h}`;
if(!this.vignette || this.vignetteKey !== key){
const radius=Math.hypot(w, h) / 2;
const g=ctx.createRadialGradient(
w / 2, h / 2, radius * VIGNETTE_INNER,
w / 2, h / 2, radius,
);
g.addColorStop(0, "rgba(0,0,0,0)");
g.addColorStop(1, `rgba(0,0,0,${VIGNETTE_MAX_ALPHA})`);
this.vignette=g;
this.vignetteKey=key;
}
ctx.save();
ctx.fillStyle=this.vignette;
ctx.fillRect(0, 0, w, h);
ctx.restore();
}
private safeRender(
renderer: LayerRenderer,
id: string,
frame: FrameContext,
opacity: number,
depthBlurPx?: number,
): void {
const pass=this.layerPassCtx;
pass.setTransform(1, 0, 0, 1, 0, 0);
pass.clearRect(0, 0, this.layerPass.width, this.layerPass.height);
pass.drawImage(this.canvas, 0, 0);
pass.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
pass.save();
try {
if(depthBlurPx && supportsCanvasFilter()){
pass.filter=`blur(${depthBlurPx}px)`;
}
renderer.render(frame, 1);
}catch(err){
if(!this.faultedRenderers.has(id)){
this.faultedRenderers.add(id);
console.error(`[simulator] layer "${id}" renderer threw; skipping it.`, err);
}
}finally {
pass.restore();
}
const ctx=this.ctx;
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalAlpha=opacity;
ctx.drawImage(this.layerPass, 0, 0);
ctx.globalAlpha=1;
ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
}
private checkHeavyStack(activeCount: number): void {
if(activeCount > HEAVY_STACK_THRESHOLD){
if(!this.warnedHeavyStack){
console.warn(
`[simulator] Heavy layer stack: ${activeCount} layers active at once ` +
`(> ${HEAVY_STACK_THRESHOLD}). Frame rate may vary on weaker hardware.`,
);
this.warnedHeavyStack=true;
}
}else{
this.warnedHeavyStack=false;
}
}
}
