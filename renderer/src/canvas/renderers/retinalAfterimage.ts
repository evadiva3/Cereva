import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { RetinalAfterimageConfig } from "../../types/layers";
import { drawSoftCircle } from "../utils/softEdge";
import { hslToRgbTuple, rgbToHsl, type RGB } from "../utils/color";
const BASE_ALPHA=0.6;
const SAMPLE_SIZE=20;
interface Satellite {
dx: number;
dy: number;
}
interface AfterimageBlob {
nx: number;
ny: number;
color: RGB;
bornMs: number;
squash: number;
angle: number;
satellites: Satellite[];
}
export class RetinalAfterimageRenderer implements LayerRenderer {
private cfg: RetinalAfterimageConfig;
private blobs: AfterimageBlob[] = [];
private rand = mulberry32(0xaf7e12);
private lastAmbientMs = -Infinity;
private gazeRef: { x: number; y: number } | null = null;
private gazeStartMs = 0;

constructor(cfg: RetinalAfterimageConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as RetinalAfterimageConfig;
}
dispose(): void {
this.blobs=[];
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs, pointer }=frame;
const cfg=this.cfg;
const lifetime=cfg.hold_duration_ms + cfg.fade_duration_ms;
if(this.blobs.length){
this.blobs=this.blobs.filter((b) => timeMs - b.bornMs < lifetime);
}
if(cfg.trigger_mode !== "gaze") this.ambientSpawn(frame);
if(cfg.trigger_mode !== "ambient") this.gazeSpawn(frame);
for(const blob of this.blobs){
const age=timeMs - blob.bornMs;
let alpha=BASE_ALPHA * layerOpacity;
if(age > cfg.hold_duration_ms){
const t=Math.min(
1,
(age - cfg.hold_duration_ms) / Math.max(1, cfg.fade_duration_ms),
);
alpha *= 1 - t * t * (3 - 2 * t);
}
if(alpha <= 0.004) continue;
this.drawBlob(ctx, blob, width, height, alpha);
}

if(cfg.trigger_mode !== "ambient" && this.gazeRef && pointer){
const progress=(timeMs - this.gazeStartMs) / Math.max(1, cfg.gaze_dwell_ms);
if(progress > 0.08 && progress < 1){

ctx.save();
ctx.beginPath();
ctx.arc(pointer.x, pointer.y, 14, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
ctx.strokeStyle="rgba(15,23,42,0.4)";
ctx.lineWidth=3.5;
ctx.stroke();
ctx.strokeStyle="rgba(255,255,255,0.55)";
ctx.lineWidth=1.5;
ctx.stroke();
ctx.restore();
}
}
}
private ambientSpawn(frame: FrameContext): void {
const cfg=this.cfg;
const interval=60000 / Math.max(0.1, cfg.spawn_rate_per_minute);
if(frame.timeMs - this.lastAmbientMs < interval) return;
this.lastAmbientMs=frame.timeMs;
if(this.blobs.length >= cfg.blob_count_max) return;
this.spawn(frame, 0.08 + this.rand() * 0.84, 0.08 + this.rand() * 0.84);
}
private gazeSpawn(frame: FrameContext): void {
const cfg=this.cfg;
const p=frame.pointer;
if(!p){
this.gazeRef=null;
return;
}
if(!this.gazeRef){
this.gazeRef={ x: p.x, y: p.y };
this.gazeStartMs=frame.timeMs;
return;
}
const drift=Math.hypot(p.x - this.gazeRef.x, p.y - this.gazeRef.y);
if(drift > cfg.gaze_trigger_radius_px){
this.gazeRef={ x: p.x, y: p.y };
this.gazeStartMs=frame.timeMs;
return;
}
if(frame.timeMs - this.gazeStartMs >= cfg.gaze_dwell_ms){
if(this.blobs.length < cfg.blob_count_max){
this.spawn(frame, this.gazeRef.x / frame.width, this.gazeRef.y / frame.height);
}
this.gazeRef={ x: p.x, y: p.y };
this.gazeStartMs=frame.timeMs;
}
}

private spawn(frame: FrameContext, nx: number, ny: number): void {
const satellites: Satellite[]=[];
const count=1 + Math.floor(this.rand() * 2);
for(let i = 0; i < count; i++){
const dir=this.rand() * Math.PI * 2;
const dist=this.cfg.blob_size_px * (0.75 + this.rand() * 0.55);
satellites.push({ dx: Math.cos(dir) * dist, dy: Math.sin(dir) * dist });
}
this.blobs.push({
nx,
ny,
color: this.sampleComplement(frame, nx, ny),
bornMs: frame.timeMs,
squash: 0.8 + this.rand() * 0.4,
angle: this.rand() * Math.PI,
satellites,
});
}
private sampleComplement(frame: FrameContext, nx: number, ny: number): RGB {
const { canvas, dpr }=frame;
const cctx=canvas.getContext("2d");
let r=128;
let g=128;
let b=128;
if(cctx){
const sx=Math.min(
Math.max(0, Math.round(nx * frame.width * dpr - SAMPLE_SIZE / 2)),
Math.max(0, canvas.width - SAMPLE_SIZE),
);
const sy=Math.min(
Math.max(0, Math.round(ny * frame.height * dpr - SAMPLE_SIZE / 2)),
Math.max(0, canvas.height - SAMPLE_SIZE),
);
try {
const img=cctx.getImageData(sx, sy, SAMPLE_SIZE, SAMPLE_SIZE);
const d=img.data;
let tr=0;
let tg=0;
let tb=0;
for(let i = 0; i < d.length; i += 4){
tr += d[i];
tg += d[i + 1];
tb += d[i + 2];
}
const n=d.length / 4;
r=tr / n;
g=tg / n;
b=tb / n;
}catch {
}
}
const [h, s, l]=rgbToHsl([r, g, b]);
return hslToRgbTuple(
(h + 180) % 360,
Math.min(1, s * 0.7),
Math.min(0.8, Math.max(0.2, l)),
);
}
private drawBlob(
ctx: CanvasRenderingContext2D,
blob: AfterimageBlob,
width: number,
height: number,
alpha: number,
): void {
const radius=Math.max(2, this.cfg.blob_size_px);
const feather=Math.min(radius, Math.max(1, this.cfg.blob_softness));
const [r, g, b]=blob.color;
const css=`rgb(${r | 0},${g | 0},${b | 0})`;
const px=blob.nx * width;
const py=blob.ny * height;
ctx.save();
ctx.translate(px, py);
ctx.rotate(blob.angle);
ctx.scale(blob.squash, 1);
drawSoftCircle(ctx, 0, 0, radius, feather, (fctx) => {
fctx.save();
fctx.globalAlpha=alpha;
fctx.fillStyle=css;
fctx.fillRect(-radius - 2, -radius - 2, radius * 2 + 4, radius * 2 + 4);
fctx.restore();
});
ctx.restore();
for(const sat of blob.satellites){
const sr=radius * 0.4;
const sf=Math.min(sr, feather * 0.6);
const sx=px + sat.dx;
const sy=py + sat.dy;
drawSoftCircle(ctx, sx, sy, sr, sf, (fctx) => {
fctx.save();
fctx.globalAlpha=alpha * 0.6;
fctx.fillStyle=css;
fctx.fillRect(sx - sr - 2, sy - sr - 2, sr * 2 + 4, sr * 2 + 4);
fctx.restore();
});
}
}
}
