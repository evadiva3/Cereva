import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { ScotomaConfig } from "../../types/layers";
import { resolveRGB } from "../colorModes";
import { drawSoftCircle, drawSoftPath } from "../utils/softEdge";
import { drawChromaticFringe } from "../utils/chromaticFringe";
import { hexToRgb } from "../utils/color";
import { makeSpeckleTile, SPECKLE_TILE_SIZE } from "../utils/speckle";
interface Harmonics {
seed: number;
freqs: number[];
phases: number[];
weights: number[];
}
const CENTER_ALPHA=0.95;
const EDGE_ALPHA=0.75;
const DEFAULT_FILL: readonly [number, number, number]=[18, 8, 14];
const SHIMMER_PERIOD_MS=125;
const SHIMMER_TILE=SPECKLE_TILE_SIZE;
const SHIMMER_DENSITY=0.15;
export class ScotomaRenderer implements LayerRenderer {
private cfg: ScotomaConfig;

private harmonics = new Map<number, Harmonics>();
private shimmerTile: HTMLCanvasElement | null = null;
private shimmerOffset = { x: 0, y: 0 };
private shimmerLastMs = -Infinity;
private shimmerRand = mulberry32(0x5c07);
constructor(cfg: ScotomaConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as ScotomaConfig;
}
dispose(): void {
this.shimmerTile=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const minDim=Math.min(width, height);
if(timeMs - this.shimmerLastMs >= SHIMMER_PERIOD_MS){
this.shimmerLastMs=timeMs;
this.shimmerOffset={
x: Math.floor(this.shimmerRand() * SHIMMER_TILE),
y: Math.floor(this.shimmerRand() * SHIMMER_TILE),
};
}
for(const blob of this.cfg.scotomas){
const cx=blob.x * width;
const cy=blob.y * height;
const radius=blob.size * minDim;
const alpha=blob.opacity * layerOpacity;
if(alpha <= 0.003 || radius <= 0) continue;

const seamless=this.cfg.seamless ?? false;
let feather: number;
let maskRadius: number;
if(seamless){
feather=radius * 1.4;
maskRadius=radius * 0.25 + feather;
}else{
const soft=Math.max(1, this.cfg.edge_softness_px ?? 45) * 1.6;
feather=Math.min(radius, Math.max(soft, radius * 0.45));
maskRadius=radius;
}
const fill=(fctx: CanvasRenderingContext2D) =>
this.paintInterior(fctx, cx, cy, radius, alpha, timeMs);
let fringePath: Path2D;
if(blob.shape === "circular"){
drawSoftCircle(ctx, cx, cy, maskRadius, feather, fill);
fringePath=new Path2D();
fringePath.arc(cx, cy, radius - feather * 0.25, 0, Math.PI * 2);
}else{
const outline=this.outlinePoints(cx, cy, radius, blob.seed);
drawSoftPath(ctx, outline, feather, fill);
fringePath=new Path2D();
outline.forEach((p, i) =>
i === 0 ? fringePath.moveTo(p.x, p.y) : fringePath.lineTo(p.x, p.y),
);
fringePath.closePath();
}
if(seamless) continue;
const borderColor=this.cfg.border_color ?? "#2a1535";
if(this.cfg.color_mode === "spectrum"){
drawChromaticFringe(ctx, fringePath, 4, "fixed", borderColor, timeMs, {
opacity: 0.2 * alpha,
});
}
drawChromaticFringe(
ctx, fringePath, 4, this.cfg.color_mode, borderColor, timeMs,
{
opacity: (this.cfg.color_mode === "spectrum" ? 0.5 : 0.22) * alpha,
cycleSpeed: this.cfg.rainbow_cycle_speed,
},
);
}
}
private paintInterior(
fctx: CanvasRenderingContext2D,
cx: number,
cy: number,
radius: number,
alpha: number,
timeMs: number,
): void {
const fill=hexToRgb(this.cfg.fill_color ?? "#12080e", DEFAULT_FILL);
const tinted=resolveRGB(this.cfg, fill, timeMs);
const isTinted=tinted !== fill;
const [cr, cg, cb, ca]=isTinted
? [tinted[0] * 0.55, tinted[1] * 0.55, tinted[2] * 0.55, CENTER_ALPHA]
: [fill[0] * 0.85, fill[1] * 0.85, fill[2] * 0.85, CENTER_ALPHA];
const [er, eg, eb, ea]=isTinted
? [tinted[0], tinted[1], tinted[2], EDGE_ALPHA]
: [
Math.min(255, fill[0] * 1.5 + 12),
Math.min(255, fill[1] * 1.5 + 12),
Math.min(255, fill[2] * 1.5 + 12),
EDGE_ALPHA,
];

const pad=radius * (this.cfg.seamless ? 2.0 : 1.6);
const g=fctx.createRadialGradient(cx, cy, 0, cx, cy, pad);
g.addColorStop(0, `rgba(${cr | 0},${cg | 0},${cb | 0},${ca})`);
g.addColorStop(Math.min(1, radius / pad), `rgba(${er | 0},${eg | 0},${eb | 0},${ea})`);
g.addColorStop(1, `rgba(${er | 0},${eg | 0},${eb | 0},${ea})`);
fctx.save();
fctx.globalAlpha=alpha;
fctx.fillStyle=g;
fctx.fillRect(cx - pad, cy - pad, pad * 2, pad * 2);
if(!this.shimmerTile){
this.shimmerTile=makeSpeckleTile(0x7a11, SHIMMER_DENSITY, [255, 235, 255]);
}
const pattern=fctx.createPattern(this.shimmerTile!, "repeat");
if(pattern){
fctx.globalAlpha=alpha * 0.12 * (this.cfg.seamless ? 0.6 : 1);
fctx.translate(this.shimmerOffset.x, this.shimmerOffset.y);
fctx.fillStyle=pattern;
fctx.fillRect(
cx - pad - this.shimmerOffset.x - SHIMMER_TILE,
cy - pad - this.shimmerOffset.y - SHIMMER_TILE,
pad * 2 + SHIMMER_TILE * 2,
pad * 2 + SHIMMER_TILE * 2,
);
}
fctx.restore();
}
private outlinePoints(
cx: number,
cy: number,
baseRadius: number,
seed: number,
): Array<{ x: number; y: number }> {
const h=this.harmonicsFor(seed);
const points=48;
const out: Array<{ x: number; y: number }>=[];
for(let i = 0; i <= points; i++){
const theta=(i / points) * Math.PI * 2;
let mod=0;
for(let j = 0; j < h.freqs.length; j++){
mod += h.weights[j] * Math.sin(h.freqs[j] * theta + h.phases[j]);
}
const rr=baseRadius * (1 + 0.28 * mod);
out.push({ x: cx + Math.cos(theta) * rr, y: cy + Math.sin(theta) * rr });
}
return out;
}
private harmonicsFor(seed: number): Harmonics {
let h=this.harmonics.get(seed);
if(!h){
const rand=mulberry32(seed || 1);
h={
seed,
freqs: [2 + Math.floor(rand() * 2), 3 + Math.floor(rand() * 3), 5 + Math.floor(rand() * 4)],
phases: [rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2],
weights: [0.5 + rand() * 0.3, 0.25 + rand() * 0.2, 0.1 + rand() * 0.15],
};
this.harmonics.set(seed, h);
}
return h;
}
}
