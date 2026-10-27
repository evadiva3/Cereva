import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { FortificationSpectraConfig } from "../../types/layers";
import { rainbowHue } from "../colorModes";
const HUE_BUCKETS=24;
const MAX_VERTS=480;
const SHIMMER_PERIOD_MS=100;
const SHIMMER_TILE=128;
export class FortificationSpectraRenderer implements LayerRenderer {
private cfg: FortificationSpectraConfig;
private shimmerTile: HTMLCanvasElement | null = null;
private shimmerPattern: CanvasPattern | null = null;
private shimmerOffset = { x: 0, y: 0 };
private shimmerLastMs = -Infinity;
private shimmerRand = mulberry32(0x51c0);
private bucketPaths: (Path2D | null)[] = new Array(HUE_BUCKETS).fill(null);
constructor(cfg: FortificationSpectraConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as FortificationSpectraConfig;
}
dispose(): void {
this.shimmerTile=null;
this.shimmerPattern=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
const cycleMs=cfg.cycle_duration_seconds * 1000;
const phase=(timeMs % cycleMs) / cycleMs;
const elapsed=phase * cfg.cycle_duration_seconds;
const radius=(8 + cfg.expansion_rate * elapsed) * (cfg.radius_scale ?? 1);
let envelope=1;
if(phase < 0.05) envelope = phase / 0.05;
else if(phase > 0.85) envelope = (1 - phase) / 0.15;
const t=timeMs / 1000;
const scintillation=0.8 + 0.2 * Math.sin(t * 9.7);
const alpha=layerOpacity * envelope * scintillation;
if(alpha <= 0.003 || radius <= 1) return;
const cx=cfg.origin_x * width;
const cy=cfg.origin_y * height;
const towardCenter=Math.atan2(height / 2 - cy, width / 2 - cx);
const arcRad=(cfg.arc_angle_degrees * Math.PI) / 180;
const a0=towardCenter - arcRad / 2;
const a1=a0 + arcRad;
ctx.save();
const sector=new Path2D();
sector.moveTo(cx, cy);
sector.arc(cx, cy, radius, a0, a1);
sector.closePath();
const innerStop=Math.max(0.001, 1 - (cfg.zigzag_amplitude * 2.5) / radius);
const scotoma=ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
const sAlpha=0.24 * envelope * layerOpacity;
scotoma.addColorStop(0, "rgba(12,12,18,0)");
scotoma.addColorStop(Math.min(0.95, innerStop), `rgba(12,12,18,${(sAlpha * 0.55).toFixed(3)})`);
scotoma.addColorStop(1, `rgba(12,12,18,${sAlpha.toFixed(3)})`);
ctx.fillStyle=scotoma;
ctx.fill(sector);

this.drawShimmer(ctx, sector, cx, cy, radius, timeMs, envelope * layerOpacity);
const arcLength=radius * arcRad;
let teeth=Math.max(4, Math.round((arcLength / 100) * cfg.zigzag_frequency) * 2);
teeth=Math.min(teeth, MAX_VERTS);
const verts: Array<{ x: number; y: number }>=[];
for(let i = 0; i <= teeth; i++){
const angle=a0 + (arcRad * i) / teeth;
const pulse=0.85 + 0.15 * Math.sin(t * 6 + i * 1.7);
const rr=radius + (i % 2 === 0 ? 1 : -1) * cfg.zigzag_amplitude * pulse;
verts.push({ x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr });
}
const full=new Path2D();
verts.forEach((v, i) => (i === 0 ? full.moveTo(v.x, v.y) : full.lineTo(v.x, v.y)));
ctx.lineJoin="miter";
ctx.miterLimit=8;
ctx.lineCap="butt";

const rainbow=cfg.color_mode === "rainbow";
const baseHue=rainbow
? rainbowHue(t, cfg.rainbow_cycle_speed)
: hexToHue(cfg.color);
const glowW=Math.max(30, cfg.zigzag_amplitude * 2.2);
ctx.globalCompositeOperation="screen";
ctx.strokeStyle=`hsla(${baseHue}, 85%, 65%, 1)`;
ctx.globalAlpha=alpha * 0.1;
ctx.lineWidth=glowW * 1.8;
ctx.stroke(full);
ctx.globalAlpha=alpha * 0.16;
ctx.lineWidth=glowW;
ctx.stroke(full);
ctx.strokeStyle="rgba(255,255,255,1)";
ctx.globalAlpha=alpha * 0.18;
ctx.lineWidth=7;
ctx.stroke(full);

const bandOffsets=[-3.5, 0, 3.5];
const hueStagger=rainbow ? 34 : 14;
ctx.globalCompositeOperation="source-over";
ctx.lineWidth=3;
for(let pass = 0; pass < bandOffsets.length; pass++){
const off=bandOffsets[pass];
this.bucketPaths.fill(null);
for(let i = 0; i < verts.length - 1; i++){
const u=i / (verts.length - 1);
const sweep=rainbow ? u * 360 : (u - 0.5) * 70;
const silver=!rainbow && i % 4 === 2;
const hue=silver ? 225 : (((baseHue + sweep + pass * hueStagger) % 360) + 360) % 360;
const bucket=Math.floor((hue / 360) * HUE_BUCKETS) % HUE_BUCKETS;
let path=this.bucketPaths[bucket];
if(!path){
path=new Path2D();
this.bucketPaths[bucket]=path;
}

const a=verts[i];
const b=verts[i + 1];
const da=Math.hypot(a.x - cx, a.y - cy) || 1;
const db=Math.hypot(b.x - cx, b.y - cy) || 1;
path.moveTo(a.x + ((a.x - cx) / da) * off, a.y + ((a.y - cy) / da) * off);
path.lineTo(b.x + ((b.x - cx) / db) * off, b.y + ((b.y - cy) / db) * off);
}
const flank=pass === 1 ? 0 : 1;
ctx.globalAlpha=alpha * (flank ? 0.55 : 0.95);
for(let bkt = 0; bkt < HUE_BUCKETS; bkt++){
const path=this.bucketPaths[bkt];
if(!path) continue;
const hue=((bkt + 0.5) / HUE_BUCKETS) * 360;
const light=flank ? 68 : 55;
ctx.strokeStyle=`hsl(${hue}, 95%, ${light}%)`;
ctx.stroke(path);
}
}
ctx.restore();
}
private drawShimmer(
ctx: CanvasRenderingContext2D,
sector: Path2D,
cx: number,
cy: number,
radius: number,
timeMs: number,
strength: number,
): void {
if(strength <= 0.01 || radius < 24) return;
if(!this.shimmerTile) this.buildShimmerTile();
if(!this.shimmerPattern){
this.shimmerPattern=ctx.createPattern(this.shimmerTile!, "repeat");
if(!this.shimmerPattern) return;
}
if(timeMs - this.shimmerLastMs >= SHIMMER_PERIOD_MS){
this.shimmerLastMs=timeMs;
this.shimmerOffset={
x: Math.floor(this.shimmerRand() * SHIMMER_TILE),
y: Math.floor(this.shimmerRand() * SHIMMER_TILE),
};
}
ctx.save();
ctx.clip(sector);
ctx.globalAlpha=0.1 * strength;
ctx.translate(this.shimmerOffset.x, this.shimmerOffset.y);
ctx.fillStyle=this.shimmerPattern;
ctx.fillRect(
cx - radius - this.shimmerOffset.x - SHIMMER_TILE,
cy - radius - this.shimmerOffset.y - SHIMMER_TILE,
radius * 2 + SHIMMER_TILE * 2,
radius * 2 + SHIMMER_TILE * 2,
);
ctx.restore();
}
private buildShimmerTile(): void {
const tile=document.createElement("canvas");
tile.width=SHIMMER_TILE;
tile.height=SHIMMER_TILE;
const tctx=tile.getContext("2d")!;
const rand=mulberry32(41117);
const img=tctx.createImageData(SHIMMER_TILE, SHIMMER_TILE);
for(let i = 0; i < img.data.length; i += 4){
if(rand() < 0.16){
const v=170 + Math.floor(rand() * 85);
img.data[i]=img.data[i + 1] = img.data[i + 2] = v;
img.data[i + 3] = 120 + Math.floor(rand() * 135);
}
}
tctx.putImageData(img, 0, 0);
this.shimmerTile=tile;
}
}
function hexToHue(hex: string): number {
const r=parseInt(hex.slice(1, 3), 16) / 255;
const g=parseInt(hex.slice(3, 5), 16) / 255;
const b=parseInt(hex.slice(5, 7), 16) / 255;
const max=Math.max(r, g, b);
const min=Math.min(r, g, b);
const d=max - min;
if(d === 0) return 0;
let h: number;
if(max === r) h = ((g - b) / d) % 6;
else if(max === g) h = (b - r) / d + 2;
else h = (r - g) / d + 4;
return ((h * 60) % 360 + 360) % 360;
}
