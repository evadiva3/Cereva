import type { FrameContext, LayerRenderer } from "../types";
import { supportsCanvasFilter } from "../types";
import type { EdgeGlowConfig } from "../../types/layers";
import { resolveColor } from "../colorModes";
const UPDATE_INTERVAL_MS=33;
const SCALE=0.5;
const TEXT_UPDATE_INTERVAL_MS=250;
const SPECTRUM_HSL: ReadonlyArray<readonly [number, number, number]>=[
[0, 100, 60],
[30, 100, 60],
[60, 100, 65],
[120, 100, 45],
[220, 100, 60],
[260, 100, 55],
[280, 80, 55],
];
const SPECTRUM_PASS_ALPHA=(1 / 7) * 1.4;
export class EdgeGlowRenderer implements LayerRenderer {
private cfg: EdgeGlowConfig;
private lastUpdateMs = -Infinity;
private small: HTMLCanvasElement | null = null;
private edges: HTMLCanvasElement | null = null;
private tint: HTMLCanvasElement | null = null;
private glow: HTMLCanvasElement | null = null;
constructor(cfg: EdgeGlowConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as EdgeGlowConfig;
}

dispose(): void {
this.small=this.edges = this.tint = this.glow = null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, timeMs }=frame;
const cfg=this.cfg;
let opacity=cfg.glow_opacity * layerOpacity;
if(cfg.pulse){
opacity *= 0.5 + 0.5 * Math.sin((timeMs / 1000) * cfg.pulse_frequency_hz * Math.PI * 2);
}
if(opacity <= 0.004) return;
const isTextScene=frame.backgroundType === "reading_passage";
const scale=isTextScene ? 1 : SCALE;
const interval=isTextScene ? TEXT_UPDATE_INTERVAL_MS : UPDATE_INTERVAL_MS;
const sw=Math.max(1, Math.round(width * scale));
const sh=Math.max(1, Math.round(height * scale));
const resized=this.ensureBuffers(sw, sh);
if(resized || timeMs - this.lastUpdateMs >= interval){
this.lastUpdateMs=timeMs;
this.detectEdges(canvas, sw, sh);
this.bakeGlow(sw, sh, timeMs, scale);
}

ctx.save();
ctx.globalCompositeOperation="screen";
ctx.globalAlpha=opacity;
ctx.imageSmoothingEnabled=true;
ctx.drawImage(this.glow!, 0, 0, sw, sh, 0, 0, width, height);
ctx.restore();
}
private detectEdges(composite: HTMLCanvasElement, sw: number, sh: number): void {
const sctx=this.small!.getContext("2d", { willReadFrequently: true })!;
sctx.globalCompositeOperation="copy";
sctx.drawImage(composite, 0, 0, composite.width, composite.height, 0, 0, sw, sh);

const src=sctx.getImageData(0, 0, sw, sh);
const s=src.data;

const gray=new Float32Array(sw * sh);
for(let i = 0,p=0; i < s.length; i += 4, p++){
gray[p]=0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
}
const ectx=this.edges!.getContext("2d")!;
const out=ectx.createImageData(sw, sh);
const o=out.data;
const threshold=this.cfg.detection_threshold;

for(let y = 1; y < sh - 1; y++){
const row=y * sw;
for(let x = 1; x < sw - 1; x++){
const p=row + x;
const tl=gray[p - sw - 1],tc=gray[p - sw],tr=gray[p - sw + 1];
const ml=gray[p - 1],mr=gray[p + 1];
const bl=gray[p + sw - 1],bc=gray[p + sw],br=gray[p + sw + 1];
const gx=-tl - 2 * ml - bl + tr + 2 * mr + br;
const gy=-tl - 2 * tc - tr + bl + 2 * bc + br;
const mag=Math.sqrt(gx * gx + gy * gy);
if(mag <= threshold) continue;
const i=p * 4;
const a=Math.min(255, (mag - threshold) * 1.6);
o[i]=o[i + 1] = o[i + 2] = 255;
o[i + 3] = a;
}
}
ectx.putImageData(out, 0, 0);
}
private bakeGlow(sw: number, sh: number, timeMs: number, scale: number): void {
const cfg=this.cfg;
const gctx=this.glow!.getContext("2d")!;
gctx.setTransform(1, 0, 0, 1, 0, 0);
gctx.globalCompositeOperation="source-over";
gctx.globalAlpha=1;
gctx.clearRect(0, 0, sw, sh);
const spread=Math.max(0.5, cfg.glow_width_px * 0.5 * scale);
const ab=cfg.aberration_offset_px * scale;
if(cfg.color_mode === "spectrum"){

const off=Math.max(ab, 1 * scale);
const diag=Math.SQRT1_2;
gctx.globalCompositeOperation="lighter";
gctx.globalAlpha=SPECTRUM_PASS_ALPHA;
for(let i = 0; i < SPECTRUM_HSL.length; i++){
const [h, s, l]=SPECTRUM_HSL[i];
const d=(i - 3) * off;
this.stampTinted(gctx, `hsl(${h}, ${s}%, ${l}%)`, d * diag, d * diag, spread, sw, sh);
}
gctx.globalAlpha=1;
return;
}
const color=resolveColor(cfg, cfg.glow_color, timeMs);
if(cfg.chromatic_aberration && ab >= 0.5){
const [r, g, b]=hexToRgbSafe(color);
gctx.globalCompositeOperation="lighter";
this.stampTinted(gctx, `rgb(${r},0,0)`, -ab, 0, spread, sw, sh);
this.stampTinted(gctx, `rgb(0,${g},0)`, 0, 0, spread, sw, sh);
this.stampTinted(gctx, `rgb(0,0,${b})`, ab, 0, spread, sw, sh);
}else{
this.stampTinted(gctx, color, 0, 0, spread, sw, sh);
}
}
private stampTinted(
dst: CanvasRenderingContext2D,
css: string,
dx: number,
dy: number,
spread: number,
sw: number,
sh: number,
): void {

const tctx=this.tint!.getContext("2d")!;
tctx.globalCompositeOperation="copy";
tctx.drawImage(this.edges!, 0, 0);
tctx.globalCompositeOperation="source-in";
tctx.fillStyle=css;
tctx.fillRect(0, 0, sw, sh);
if(supportsCanvasFilter()){
dst.filter=`blur(${spread}px)`;
dst.drawImage(this.tint!, dx, dy);
dst.filter="none";
}else{
const prev=dst.globalAlpha;
dst.globalAlpha=prev * 0.35;
for(const [ox, oy] of [[spread, 0], [-spread, 0], [0, spread], [0, -spread]]){
dst.drawImage(this.tint!, dx + ox, dy + oy);
}
dst.globalAlpha=prev;
}
dst.drawImage(this.tint!, dx, dy);
}
private ensureBuffers(sw: number, sh: number): boolean {
if(
this.small &&
this.small.width === sw &&
this.small.height === sh
){
return false;
}
for(const key of ["small", "edges", "tint", "glow"] as const){
if(!this[key]) this[key] = document.createElement("canvas");
this[key]!.width = sw;
this[key]!.height = sh;
}
return true;
}
}
function hexToRgbSafe(css: string): [number, number, number] {
if(css.startsWith("#") && css.length === 7){
return [
parseInt(css.slice(1, 3), 16),
parseInt(css.slice(3, 5), 16),
parseInt(css.slice(5, 7), 16),
];
}
const m=css.match(/hsl\(\s*([\d.]+)/);
if(m){

return hslToRgbLocal(parseFloat(m[1]), 0.9, 0.52);
}
return [255, 255, 255];
}
function hslToRgbLocal(h: number, s: number, l: number): [number, number, number] {
const c=(1 - Math.abs(2 * l - 1)) * s;
const hp=((h % 360) + 360) % 360 / 60;
const x=c * (1 - Math.abs((hp % 2) - 1));
let r=0,g=0,b=0;
if(hp < 1) [r, g, b] = [c, x, 0];
else if(hp < 2) [r, g, b] = [x, c, 0];
else if(hp < 3) [r, g, b] = [0, c, x];
else if(hp < 4) [r, g, b] = [0, x, c];
else if(hp < 5) [r, g, b] = [x, 0, c];
else [r, g, b] = [c, 0, x];
const m=l - c / 2;
return [
Math.round((r + m) * 255),
Math.round((g + m) * 255),
Math.round((b + m) * 255),
];
}
