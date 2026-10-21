import type { FrameContext, LayerRenderer } from "../types";
import type { PalinopsiaConfig } from "../../types/layers";
const GHOST_RADIUS=26;
const DRIFTER_RADIUS=7;
export class PalinopsiaRenderer implements LayerRenderer {
private cfg: PalinopsiaConfig;
private trail: HTMLCanvasElement | null = null;
private drifterT = 0;
constructor(cfg: PalinopsiaConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as PalinopsiaConfig;
}
dispose(): void {
this.trail=null;
}

render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, dtMs, dpr }=frame;
const cfg=this.cfg;
const dt=dtMs / 1000;
const trail=this.ensureTrail(canvas.width, canvas.height);
const tctx=trail.getContext("2d")!;

const fade=Math.min(1, dt * cfg.decay_speed * (1.6 - 1.35 * cfg.trail_length) * 2.5);
if(fade > 0){
tctx.setTransform(1, 0, 0, 1, 0, 0);
tctx.globalCompositeOperation="destination-out";
tctx.globalAlpha=fade;
tctx.fillStyle="#000";
tctx.fillRect(0, 0, trail.width, trail.height);
}

this.drifterT += dt;
const dx=width * (0.5 + 0.36 * Math.sin(this.drifterT * 0.7));
const dy=height * (0.5 + 0.3 * Math.sin(this.drifterT * 1.13 + 1.4));
ctx.fillStyle="#1a1a1a";
ctx.beginPath();
ctx.arc(dx, dy, DRIFTER_RADIUS, 0, Math.PI * 2);
ctx.fill();
const sources: Array<{ x: number; y: number; r: number }>=[
{ x: dx, y: dy, r: DRIFTER_RADIUS * 2.2 },
];
if(frame.pointer){
sources.push({ x: frame.pointer.x, y: frame.pointer.y, r: GHOST_RADIUS });
}
tctx.globalCompositeOperation="source-over";
for(const src of sources){
tctx.save();
tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
tctx.beginPath();
tctx.arc(src.x, src.y, src.r, 0, Math.PI * 2);
tctx.clip();
tctx.globalAlpha=cfg.opacity;
tctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
tctx.restore();
}

ctx.save();
ctx.globalAlpha=layerOpacity;
ctx.drawImage(trail, 0, 0, trail.width, trail.height, 0, 0, width, height);
ctx.restore();
}
private ensureTrail(w: number, h: number): HTMLCanvasElement {
if(!this.trail) this.trail = document.createElement("canvas");
if(this.trail.width !== w || this.trail.height !== h){
this.trail.width=w;
this.trail.height=h;
}
return this.trail;
}
}
