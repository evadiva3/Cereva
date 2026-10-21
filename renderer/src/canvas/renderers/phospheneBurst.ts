import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { PhospheneBurstConfig } from "../../types/layers";
const MAX_BURSTS_PER_MINUTE=60;
const TAU_MS=130;
const LIFETIME_MS=450;
type BurstShape="star" | "ring" | "ray_burst";
interface ActiveBurst {
x: number;
y: number;
shape: BurstShape;
startMs: number;
variant: number;
}
export class PhospheneBurstRenderer implements LayerRenderer {
private cfg: PhospheneBurstConfig;
private rand = mulberry32(0xb0057);
private nextBurstMs = 0;
private active: ActiveBurst[] = [];
constructor(cfg: PhospheneBurstConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as PhospheneBurstConfig;
}

render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
const rate=Math.min(cfg.burst_rate_per_minute, MAX_BURSTS_PER_MINUTE);
if(rate <= 0 && this.active.length === 0) return;

if(rate > 0){
const meanInterval=60000 / rate;
if(this.nextBurstMs === 0) this.nextBurstMs = timeMs + meanInterval * this.rand();
while(timeMs >= this.nextBurstMs){
const shape: BurstShape =
cfg.shape_type === "random"
? (["star", "ring", "ray_burst"] as const)[Math.floor(this.rand() * 3)]
: cfg.shape_type;
this.active.push({
x: (0.08 + 0.84 * this.rand()) * width,
y: (0.08 + 0.84 * this.rand()) * height,
shape,
startMs: this.nextBurstMs,
variant: this.rand(),
});
this.nextBurstMs += meanInterval * (0.65 + 0.7 * this.rand());
}
}
if(this.active.length === 0) return;
ctx.save();
ctx.globalCompositeOperation="lighter";
ctx.strokeStyle=cfg.color;
ctx.fillStyle=cfg.color;
ctx.lineCap="round";
let write=0;
for(const burst of this.active){
const age=timeMs - burst.startMs;
if(age >= LIFETIME_MS) continue;
this.active[write++] = burst;
const alpha=Math.exp(-age / TAU_MS) * layerOpacity;
if(alpha <= 0.006) continue;
const radius=(cfg.size_px / 2) * (1 + 0.15 * (age / LIFETIME_MS));
ctx.globalAlpha=alpha;
this.drawBurst(ctx, burst, radius);
}
this.active.length=write;
ctx.restore();
}
private drawBurst(
ctx: CanvasRenderingContext2D,
burst: ActiveBurst,
r: number,
): void {
const { x, y, shape, variant }=burst;
const core=ctx.createRadialGradient(x, y, 0, x, y, r * 0.45);
core.addColorStop(0, "rgba(255,255,255,0.95)");
core.addColorStop(1, "rgba(255,255,255,0)");
const keepFill=ctx.fillStyle;
ctx.fillStyle=core;
ctx.beginPath();
ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
ctx.fill();
ctx.fillStyle=keepFill;
if(shape === "star"){
const points=4 + Math.floor(variant * 4);
const rot=variant * Math.PI;
ctx.beginPath();
for(let i = 0; i < points * 2; i++){
const angle=rot + (i * Math.PI) / points;
const rr=i % 2 === 0 ? r : r * 0.42;
const px=x + Math.cos(angle) * rr;
const py=y + Math.sin(angle) * rr;
if(i === 0) ctx.moveTo(px, py);
else ctx.lineTo(px, py);
}
ctx.closePath();
ctx.globalAlpha *= 0.85;
ctx.fill();
}else if(shape === "ring"){
ctx.lineWidth=Math.max(2, r * 0.14);
ctx.beginPath();
ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
ctx.stroke();
ctx.lineWidth=Math.max(1, r * 0.05);
ctx.beginPath();
ctx.arc(x, y, r * 0.55, 0, Math.PI * 2);
ctx.stroke();
}else{
const rays=7 + Math.floor(variant * 6);
const rot=variant * Math.PI * 2;
ctx.lineWidth=Math.max(1.5, r * 0.06);
ctx.beginPath();
for(let i = 0; i < rays; i++){
const angle=rot + (i / rays) * Math.PI * 2;
const len=r * (0.6 + 0.4 * Math.abs(Math.sin(variant * 17 + i * 2.3)));
ctx.moveTo(x + Math.cos(angle) * r * 0.2, y + Math.sin(angle) * r * 0.2);
ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
}
ctx.stroke();
}
}
}
