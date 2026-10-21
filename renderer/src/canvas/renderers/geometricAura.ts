import { mulberry32, supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { GeometricAuraConfig } from "../../types/layers";
import { rainbowHue } from "../colorModes";
import { drawChromaticFringe } from "../utils/chromaticFringe";
import { hexToRgb, rotateHue, type RGB } from "../utils/color";
import { makeSpeckleTile, SPECKLE_TILE_SIZE } from "../utils/speckle";
const SPRITE_RES=96;
const PERTURB=0.25;
const EXTENT=1 + PERTURB + 0.08;
const OUTLINE_POINTS=64;
const SHIMMER_PERIOD_MS=125;
interface Harmonics {
freqs: number[];
phases: number[];
weights: number[];
}
interface Sprite {
canvas: HTMLCanvasElement;
key: string;
}
export class GeometricAuraRenderer implements LayerRenderer {
private cfg: GeometricAuraConfig;
private sprites = new Map<number, Sprite>();
private harmonics = new Map<number, Harmonics>();
private shimmerTile: HTMLCanvasElement | null = null;
private shimmerOffset = { x: 0, y: 0 };
private shimmerLastMs = -Infinity;
private shimmerRand = mulberry32(0xa07a);

constructor(cfg: GeometricAuraConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as GeometricAuraConfig;
}
dispose(): void {
this.sprites.clear();
this.shimmerTile=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
const t=timeMs / 1000;
const minDim=Math.min(width, height);
if(timeMs - this.shimmerLastMs >= SHIMMER_PERIOD_MS){
this.shimmerLastMs=timeMs;
this.shimmerOffset={
x: Math.floor(this.shimmerRand() * SPECKLE_TILE_SIZE),
y: Math.floor(this.shimmerRand() * SPECKLE_TILE_SIZE),
};
}
const canFilter=supportsCanvasFilter();

const rawHueShift =
cfg.color_mode === "rainbow" ? rainbowHue(t, cfg.rainbow_cycle_speed) : 0;
const bakedHueShift=canFilter ? 0 : Math.floor(rawHueShift / 15) * 15;
cfg.shapes.forEach((shape, index) => {
const cx=shape.x * width;
const cy=shape.y * height;
const radius=shape.size * minDim;
const speed=shape.animation_speed;
const scint=speed === 0 ? 1 : 0.8 + 0.2 * Math.sin(t * speed * 3.1);
const alpha=shape.opacity * layerOpacity * scint;
if(alpha <= 0.003 || radius <= 0) return;
const h=this.harmonicsFor(index);
const sprite=this.ensureSprite(index, radius, bakedHueShift);
const half=radius * EXTENT;
const brightness=Math.max(0.1, Math.min(1, cfg.brightness ?? 0.65));

ctx.save();
ctx.globalAlpha=alpha * brightness;
if(canFilter && rawHueShift !== 0){
ctx.filter=`hue-rotate(${rawHueShift.toFixed(1)}deg)`;
}
ctx.drawImage(sprite.canvas, cx - half, cy - half, half * 2, half * 2);
ctx.globalCompositeOperation="screen";
ctx.globalAlpha=alpha * brightness * 0.25;
ctx.drawImage(sprite.canvas, cx - half, cy - half, half * 2, half * 2);
ctx.restore();
ctx.save();
ctx.globalAlpha=alpha;
const pocket=ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.45);
pocket.addColorStop(0, `rgba(255,255,255,${(brightness * 0.35).toFixed(3)})`);
pocket.addColorStop(1, "rgba(255,255,255,0)");
ctx.fillStyle=pocket;
ctx.fillRect(cx - radius * 0.45, cy - radius * 0.45, radius * 0.9, radius * 0.9);
ctx.restore();
if(cfg.shimmer){
if(!this.shimmerTile) this.shimmerTile = makeSpeckleTile(0xa07a, 0.12);
const pattern=ctx.createPattern(this.shimmerTile, "repeat");
if(pattern){
ctx.save();
ctx.beginPath();
ctx.arc(cx, cy, radius * (1 + PERTURB), 0, Math.PI * 2);
ctx.clip();
ctx.globalCompositeOperation="screen";
ctx.globalAlpha=0.12 * alpha;
ctx.translate(this.shimmerOffset.x, this.shimmerOffset.y);
ctx.fillStyle=pattern;
const pad=radius * (1 + PERTURB) + SPECKLE_TILE_SIZE;
ctx.fillRect(
cx - pad - this.shimmerOffset.x,
cy - pad - this.shimmerOffset.y,
pad * 2 + SPECKLE_TILE_SIZE,
pad * 2 + SPECKLE_TILE_SIZE,
);
ctx.restore();
}
}
const fringePath=new Path2D();
for(let i = 0; i <= OUTLINE_POINTS; i++){
const theta=(i / OUTLINE_POINTS) * Math.PI * 2;
const rr=radius * (1 + PERTURB * this.boundaryNoise(h, theta));
const px=cx + Math.cos(theta) * rr;
const py=cy + Math.sin(theta) * rr;
if(i === 0) fringePath.moveTo(px, py);
else fringePath.lineTo(px, py);
}
fringePath.closePath();
drawChromaticFringe(ctx, fringePath, 5, cfg.color_mode, cfg.outer_color, timeMs, {
opacity: (cfg.color_mode === "spectrum" ? 0.55 : 0.12) * alpha,
cycleSpeed: cfg.rainbow_cycle_speed,
});
});
for(const key of this.sprites.keys()){
if(key >= cfg.shapes.length) this.sprites.delete(key);
}
}
private boundaryNoise(h: Harmonics, theta: number): number {
let mod=0;
for(let j = 0; j < h.freqs.length; j++){
mod += h.weights[j] * Math.sin(h.freqs[j] * theta + h.phases[j]);
}
return mod;
}
private harmonicsFor(index: number): Harmonics {
let h=this.harmonics.get(index);
if(!h){
const rand=mulberry32(0xa07a + index * 7919);
h={
freqs: [2 + Math.floor(rand() * 2), 3 + Math.floor(rand() * 3), 5 + Math.floor(rand() * 4)],
phases: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
weights: [0.55 + rand() * 0.25, 0.25 + rand() * 0.15, 0.08 + rand() * 0.1],
};
const sum=h.weights.reduce((a, b) => a + b, 0);
h.weights=h.weights.map((w) => w / sum);
this.harmonics.set(index, h);
}
return h;
}
private ensureSprite(index: number, radius: number, bakedHueShift: number): Sprite {
const cfg=this.cfg;
const key=[
Math.round(radius / 8),
cfg.inner_color,
cfg.outer_color,
cfg.asymmetry.toFixed(2),
cfg.asymmetry_angle.toFixed(0),
bakedHueShift,
].join("|");
const cached=this.sprites.get(index);
if(cached && cached.key === key) return cached;
const canvas=cached?.canvas ?? document.createElement("canvas");
canvas.width=SPRITE_RES;
canvas.height=SPRITE_RES;
const sctx=canvas.getContext("2d")!;
const img=sctx.createImageData(SPRITE_RES, SPRITE_RES);
const data=img.data;
let inner: RGB=hexToRgb(cfg.inner_color, [255, 255, 255]);
let outer: RGB=hexToRgb(cfg.outer_color, [160, 192, 255]);
if(bakedHueShift !== 0){
inner=rotateHue(inner, bakedHueShift);
outer=rotateHue(outer, bakedHueShift);
}
const h=this.harmonicsFor(index);
const half=SPRITE_RES / 2;
const worldPerPx=EXTENT / half;
const asym=Math.max(0, Math.min(1, cfg.asymmetry));
const asymAngle=(cfg.asymmetry_angle * Math.PI) / 180;
for(let y = 0; y < SPRITE_RES; y++){
for(let x = 0; x < SPRITE_RES; x++){
const dx=(x + 0.5 - half) * worldPerPx;
const dy=(y + 0.5 - half) * worldPerPx;
const dist=Math.hypot(dx, dy);
const theta=Math.atan2(dy, dx);
const rTheta=1 + PERTURB * this.boundaryNoise(h, theta);
const d=dist / rTheta;
if(d >= 1) continue;
let lum=Math.pow(1 - d, 1.5);
lum *= 1 + asym * Math.cos(theta - asymAngle);
lum=Math.max(0, Math.min(1, lum));
const i=(y * SPRITE_RES + x) * 4;
data[i]=inner[0] + (outer[0] - inner[0]) * d;
data[i + 1] = inner[1] + (outer[1] - inner[1]) * d;
data[i + 2] = inner[2] + (outer[2] - inner[2]) * d;
data[i + 3] = Math.round(lum * 255);
}
}
sctx.putImageData(img, 0, 0);
const sprite: Sprite={ canvas, key };
this.sprites.set(index, sprite);
return sprite;
}
}
