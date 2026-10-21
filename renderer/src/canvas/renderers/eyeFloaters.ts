import {
mulberry32,
supportsCanvasFilter,
type FrameContext,
type LayerRenderer,
} from "../types";
import type { EyeFloatersConfig } from "../../types/layers";
const BASE_SEED=0xf10a7e;
const SS=2;
const DEFOCUS_PX=1.5;
const BAKE_VERSION=2;
interface SpinePoint {
x: number;
y: number;
w: number;
nx: number;
ny: number;
}
interface Floater {
spine: SpinePoint[];
maxWidth: number;
minX: number;
minY: number;
maxX: number;
maxY: number;
sprite: HTMLCanvasElement | null;
spriteKey: string;
nx: number;
ny: number;
vx: number;
vy: number;
rotation: number;
spin: number;

terminalMul: number;
swayPhase: number;
swayPeriod: number;
noiseSeedX: number;
noiseSeedY: number;
impulseMul: number;
decaySeconds: number;
anchorX: number;
anchorY: number;
}
export class EyeFloatersRenderer implements LayerRenderer {
private cfg: EyeFloatersConfig;
private floaters: Floater[] = [];
private shapeKey = "";
private lastPointer: { x: number; y: number } | null = null;
constructor(cfg: EyeFloatersConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as EyeFloatersConfig;
}
dispose(): void {
for(const f of this.floaters) f.sprite = null;
this.floaters=[];
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, dtMs, timeMs }=frame;
const cfg=this.cfg;
this.ensureShapes();
const dt=Math.min(dtMs / 1000, 0.1);
const t=timeMs / 1000;

let pdx=0;
let pdy=0;
if(frame.pointer){
if(this.lastPointer){
pdx=frame.pointer.x - this.lastPointer.x;
pdy=frame.pointer.y - this.lastPointer.y;
}
this.lastPointer={ x: frame.pointer.x, y: frame.pointer.y };
}else{
this.lastPointer=null;
}
const spriteKey=`v${BAKE_VERSION}|${cfg.variant}|${cfg.color}`;
ctx.save();
if(cfg.variant === "translucent"){
ctx.globalCompositeOperation="screen";
}
ctx.globalAlpha=layerOpacity;

for(const f of this.floaters){
this.advance(f, dt, t, pdx, pdy, width, height);
if(f.spriteKey !== spriteKey || !f.sprite){
bakeSprite(f, cfg);
f.spriteKey=spriteKey;
}

ctx.save();
ctx.translate(f.nx * width, f.ny * height);
ctx.rotate(f.rotation);

ctx.drawImage(
f.sprite!,
f.minX,
f.minY,
f.maxX - f.minX,
f.maxY - f.minY,
);
ctx.restore();
}
ctx.restore();
}
private advance(
f: Floater,
dt: number,
t: number,
pdx: number,
pdy: number,
width: number,
height: number,
): void {
const cfg=this.cfg;
const speed=cfg.drift_speed;
if(cfg.drift_pattern === "gravity"){
f.vy=14 * f.terminalMul * speed;
f.vx=Math.sin((t * Math.PI * 2) / f.swayPeriod + f.swayPhase) * 7 * speed;
f.rotation += f.spin * speed * dt;
}else if(cfg.drift_pattern === "random_walk"){

f.vx=(valueNoise(t * 0.4, f.noiseSeedX) - 0.5) * 2 * 30 * speed;
f.vy=(valueNoise(t * 0.4, f.noiseSeedY) - 0.5) * 2 * 30 * speed;
f.rotation += f.spin * 3 * speed * dt;
}else{

const mag=Math.hypot(pdx, pdy);
if(mag > 0){
const gain=6.5 * speed * f.impulseMul;
const capped=Math.min(mag * gain, 500 * speed);
f.vx += (pdx / mag) * capped;
f.vy += (pdy / mag) * capped;
}
const damp=Math.exp((-dt * 3) / f.decaySeconds);
f.vx *= damp;
f.vy *= damp;
f.vx += (f.anchorX - f.nx) * width * 6 * dt;
f.vy += (f.anchorY - f.ny) * height * 6 * dt;
f.vy += 4 * speed * dt;
f.rotation += f.spin * 2 * speed * dt;
}
f.nx += (f.vx * dt) / width;
f.ny += (f.vy * dt) / height;
const extent=Math.max(f.maxX - f.minX, f.maxY - f.minY);
const mx=extent / width;
const my=extent / height;
if(f.nx < -mx) { f.nx += 1 + 2 * mx; f.anchorX = f.nx; }
else if(f.nx > 1 + mx) { f.nx -= 1 + 2 * mx; f.anchorX = f.nx; }
if(f.ny < -my) { f.ny += 1 + 2 * my; f.anchorY = f.ny; }
else if(f.ny > 1 + my) { f.ny -= 1 + 2 * my; f.anchorY = f.ny; }
}
private ensureShapes(): void {
const cfg=this.cfg;
const custom=cfg.use_custom_shapes && (cfg.custom_shapes?.length ?? 0) > 0
? cfg.custom_shapes
: null;
const key=custom
? `${cfg.count}|${cfg.size_variance}|c|${JSON.stringify(custom)}`
: `${cfg.count}|${cfg.size_variance}`;
if(key === this.shapeKey) return;
this.shapeKey=key;
const previous=this.floaters;
this.floaters=[];
for(let i = 0; i < cfg.count; i++){
const f=custom
? buildCustomFloater(i, custom[i % custom.length], cfg.size_variance)
: buildFloater(i, cfg.size_variance);
const old=previous[i];
if(old){
f.nx=old.nx;
f.ny=old.ny;
f.anchorX=old.anchorX;
f.anchorY=old.anchorY;
f.rotation=old.rotation;
}
this.floaters.push(f);
}
}
}

function buildFloater(index: number, sizeVariance: number): Floater {
const rand=mulberry32(BASE_SEED + index * 7919);
const kindRoll=rand();
const kind=kindRoll < 0.6 ? "worm" : kindRoll < 0.85 ? "tadpole" : "dash";
const sizeMul=1 + sizeVariance * (rand() * 2 - 1) * 0.6;
let length: number;
let controls: number;
let lateral: number;
if(kind === "worm"){
length=(60 + rand() * 60) * sizeMul;
controls=6 + Math.floor(rand() * 7);
lateral=15;
}else if(kind === "tadpole"){
length=(40 + rand() * 30) * sizeMul;
controls=6 + Math.floor(rand() * 3);
lateral=10;
}else{
length=(15 + rand() * 15) * sizeMul;
controls=6;
lateral=2;
}
length=Math.max(12, length);
const heading=rand() * Math.PI * 2;
const ax=Math.cos(heading);
const ay=Math.sin(heading);
const px=-ay;
const py=ax;
const ctrl: Array<{ x: number; y: number }>=[];
for(let i = 0; i < controls; i++){
const u=i / (controls - 1);
const lat=(rand() * 2 - 1) * lateral;
ctrl.push({
x: ax * u * length + px * lat,
y: ay * u * length + py * lat,
});
}
const tip=2;
let mid: number;
const knots: Array<{ c: number; amp: number; sigma: number }>=[];
if(kind === "worm"){
mid=4 + rand() * 3;
const knotCount=1 + Math.floor(rand() * 2);
for(let k = 0; k < knotCount; k++){
knots.push({
c: 0.15 + rand() * 0.7,
amp: 2 + rand() * 6,
sigma: 0.05 + rand() * 0.08,
});
}
}else if(kind === "tadpole"){
mid=2.5;
knots.push({
c: 0.08 + rand() * 0.08,
amp: 8 + rand() * 4,
sigma: 0.09 + rand() * 0.05,
});
}else{
mid=2.5 + rand() * 1.5;
}
const widthAt=(u: number): number => {
let w=tip + (mid - tip) * Math.exp(-((u - 0.5) ** 2) / (2 * 0.22 ** 2));
for(const k of knots){
w += k.amp * Math.exp(-((u - k.c) ** 2) / (2 * k.sigma ** 2));
}
return Math.min(14, Math.max(2, w * Math.max(0.5, sizeMul)));
};
return finishFloater(rand, ctrl, widthAt, length);
}

function buildCustomFloater(
index: number,
shape: ReadonlyArray<readonly [number, number]>,
sizeVariance: number,
): Floater {
const rand=mulberry32(BASE_SEED + index * 7919);
const sizeMul=1 + sizeVariance * (rand() * 2 - 1) * 0.6;
const scale=120 * Math.max(0.4, sizeMul);
const ctrl=shape.map(([x, y]) => ({ x: x * scale, y: y * scale }));
let length=0;
for(let i = 1; i < ctrl.length; i++){
length += Math.hypot(ctrl[i].x - ctrl[i - 1].x, ctrl[i].y - ctrl[i - 1].y);
}
length=Math.max(12, length);
const tip=2;
const mid=4 + rand() * 3;
const knots: Array<{ c: number; amp: number; sigma: number }>=[];
const knotCount=1 + Math.floor(rand() * 2);
for(let k = 0; k < knotCount; k++){
knots.push({
c: 0.15 + rand() * 0.7,
amp: 2 + rand() * 6,
sigma: 0.05 + rand() * 0.08,
});
}
const widthAt=(u: number): number => {
let w=tip + (mid - tip) * Math.exp(-((u - 0.5) ** 2) / (2 * 0.22 ** 2));
for(const k of knots){
w += k.amp * Math.exp(-((u - k.c) ** 2) / (2 * k.sigma ** 2));
}
return Math.min(14, Math.max(2, w * Math.max(0.5, sizeMul)));
};
return finishFloater(rand, ctrl, widthAt, length);
}
function finishFloater(
rand: () => number,
ctrl: Array<{ x: number; y: number }>,
widthAt: (u: number) => number,
length: number,
): Floater {

const samples=Math.max(24, Math.round(length / 2));
const spine: SpinePoint[]=[];
for(let s = 0; s <= samples; s++){
const u=s / samples;
const p=catmullRom(ctrl, u);
spine.push({ x: p.x, y: p.y, w: widthAt(u), nx: 0, ny: 0 });
}
for(let i = 0; i < spine.length; i++){
const a=spine[Math.max(0, i - 1)];
const b=spine[Math.min(spine.length - 1, i + 1)];
const len=Math.hypot(b.x - a.x, b.y - a.y) || 1;
spine[i].nx=-(b.y - a.y) / len;
spine[i].ny=(b.x - a.x) / len;
}

let cx=0;
let cy=0;
for(const p of spine){
cx += p.x;
cy += p.y;
}
cx /= spine.length;
cy /= spine.length;
let maxWidth=0;
for(const p of spine){
p.x -= cx;
p.y -= cy;
maxWidth=Math.max(maxWidth, p.w);
}
const margin=maxWidth * 1.5 + DEFOCUS_PX * 3 + 2;
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for(const p of spine){
minX=Math.min(minX, p.x - margin);
minY=Math.min(minY, p.y - margin);
maxX=Math.max(maxX, p.x + margin);
maxY=Math.max(maxY, p.y + margin);
}
const nx=0.1 + rand() * 0.8;
const ny=0.1 + rand() * 0.8;
return {
spine,
maxWidth,
minX,
minY,
maxX,
maxY,
sprite: null,
spriteKey: "",
nx,
ny,
vx: 0,
vy: 0,
rotation: rand() * Math.PI * 2,
spin: (rand() * 2 - 1) * (0.3 * Math.PI / 180),
terminalMul: 1 + (rand() * 2 - 1) * 0.4,
swayPhase: rand() * Math.PI * 2,
swayPeriod: 3 + rand() * 5,
noiseSeedX: Math.floor(rand() * 0xffffffff),
noiseSeedY: Math.floor(rand() * 0xffffffff),
impulseMul: 0.7 + rand() * 0.6,
decaySeconds: 0.8 + rand() * 0.6,
anchorX: nx,
anchorY: ny,
};
}
function catmullRom(
pts: Array<{ x: number; y: number }>,
u: number,
): { x: number; y: number } {
const segCount=pts.length - 1;
const f=Math.min(u * segCount, segCount - 1e-6);
const i=Math.floor(f);
const t=f - i;
const p0=pts[Math.max(0, i - 1)];
const p1=pts[i];
const p2=pts[i + 1];
const p3=pts[Math.min(pts.length - 1, i + 2)];
const t2=t * t;
const t3=t2 * t;
return {
x:
0.5 *
(2 * p1.x +
(-p0.x + p2.x) * t +
(2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
(-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
y:
0.5 *
(2 * p1.y +
(-p0.y + p2.y) * t +
(2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
(-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
};
}

function bakeSprite(f: Floater, cfg: EyeFloatersConfig): void {
const w=Math.max(1, Math.ceil((f.maxX - f.minX) * SS));
const h=Math.max(1, Math.ceil((f.maxY - f.minY) * SS));
const sprite=document.createElement("canvas");
sprite.width=w;
sprite.height=h;
const ctx=sprite.getContext("2d")!;
const scratch=document.createElement("canvas");
scratch.width=w;
scratch.height=h;
const sctx=scratch.getContext("2d")!;
const toScratch=(
style: string,
widthScale: number,
offset: number,
flatWidth?: number,
) => {
sctx.setTransform(1, 0, 0, 1, 0, 0);
sctx.clearRect(0, 0, w, h);
sctx.setTransform(SS, 0, 0, SS, -f.minX * SS, -f.minY * SS);
sctx.strokeStyle=style;
sctx.lineCap="round";
sctx.lineJoin="round";
const pts=f.spine;
for(let i = 0; i < pts.length - 1; i++){
const a=pts[i];
const b=pts[i + 1];
sctx.lineWidth=flatWidth ?? Math.max(0.6, ((a.w + b.w) / 2) * widthScale);
sctx.beginPath();
sctx.moveTo(a.x + a.nx * offset, a.y + a.ny * offset);
sctx.lineTo(b.x + b.nx * offset, b.y + b.ny * offset);
sctx.stroke();
}
};
const compose=(alpha: number) => {
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalAlpha=alpha;
ctx.drawImage(scratch, 0, 0);
};
if(cfg.variant === "opaque"){
toScratch(cfg.color, 1, 0);
compose(0.55);
toScratch("#ffffff", 0.22, 1.5);
compose(0.12);
}else{
toScratch("#ffffff", 2.5, 0);
compose(0.22);
toScratch("rgb(200,220,255)", 1, 0, 1.5);
compose(0.48);
}

if(supportsCanvasFilter()){
sctx.setTransform(1, 0, 0, 1, 0, 0);
sctx.globalAlpha=1;
sctx.clearRect(0, 0, w, h);
sctx.drawImage(sprite, 0, 0);
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalAlpha=1;
ctx.clearRect(0, 0, w, h);
ctx.filter=`blur(${DEFOCUS_PX * SS}px)`;
ctx.drawImage(scratch, 0, 0);
ctx.filter="none";
}
f.sprite=sprite;
}

function hash01(seed: number, i: number): number {
let h=(seed ^ Math.imul(i, 0x9e3779b1)) >>> 0;
h=Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
h=Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(t: number, seed: number): number {
const i=Math.floor(t);
const fr=t - i;
const s=fr * fr * (3 - 2 * fr);
return hash01(seed, i) * (1 - s) + hash01(seed, i + 1) * s;
}
