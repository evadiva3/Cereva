import type { FrameContext, LayerRenderer } from "../types";
import type { AfterimageTrailConfig } from "../../types/layers";
const SNAPSHOT_SCALE=0.25;
const MOTION_HOLD_MS=250;
export class AfterimageTrailRenderer implements LayerRenderer {
private cfg: AfterimageTrailConfig;
private buffer: (HTMLCanvasElement | undefined)[] = [];
private head = 0;
private filled = 0;
private lastPointer: { x: number; y: number } | null = null;
private lastMotionMs = -Infinity;
constructor(cfg: AfterimageTrailConfig){
this.cfg=cfg;
}
update(config: unknown): void {
const next=config as AfterimageTrailConfig;
if(next.trail_length_frames !== this.cfg.trail_length_frames){
this.buffer=[];
this.head=0;
this.filled=0;
}
this.cfg=next;
}

dispose(): void {
this.buffer=[];
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, timeMs }=frame;
const cfg=this.cfg;
const n=cfg.trail_length_frames;

if(frame.pointer){
const p=frame.pointer;
if(
this.lastPointer &&
(Math.abs(p.x - this.lastPointer.x) > 1 || Math.abs(p.y - this.lastPointer.y) > 1)
){
this.lastMotionMs=timeMs;
}
this.lastPointer={ x: p.x, y: p.y };
}
const inMotion=timeMs - this.lastMotionMs < MOTION_HOLD_MS;

const sw=Math.max(1, Math.round(canvas.width * SNAPSHOT_SCALE));
const sh=Math.max(1, Math.round(canvas.height * SNAPSHOT_SCALE));
if(this.buffer.length !== n){
this.buffer=new Array(n);
this.head=0;
this.filled=0;
}
let snap=this.buffer[this.head];
if(!snap){
snap=document.createElement("canvas");
this.buffer[this.head]=snap;
}
if(snap.width !== sw || snap.height !== sh){
snap.width=sw;
snap.height=sh;
}
const sctx=snap.getContext("2d")!;
sctx.clearRect(0, 0, sw, sh);
sctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, sw, sh);
this.head=(this.head + 1) % n;
this.filled=Math.min(this.filled + 1, n);
const active=cfg.triggers_on === "always" || inMotion;
if(!active || this.filled < 2) return;
for(let age = this.filled; age >= 2; age--){
const idx=(((this.head - age) % n) + n) % n;
const old=this.buffer[idx];
if(!old) continue;
const k=age - 1;
const decay =
cfg.decay_curve === "linear" ? 1 - k / n : Math.exp((-3 * k) / n);
const alpha=cfg.opacity_start * decay * layerOpacity;
if(alpha <= 0.004) continue;
ctx.save();
ctx.globalAlpha=alpha;
ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, width, height);
ctx.restore();
}
}
}
