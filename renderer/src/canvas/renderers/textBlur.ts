import { supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { TextBlurConfig } from "../../types/layers";
export class TextBlurRenderer implements LayerRenderer {
private cfg: TextBlurConfig;
private buffer: HTMLCanvasElement | null = null;
constructor(cfg: TextBlurConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as TextBlurConfig;
}
dispose(): void {
this.buffer=null;
}

render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, timeMs }=frame;
const cfg=this.cfg;
let radius=cfg.blur_radius_px;
if(cfg.pulse){
const osc=0.5 + 0.5 * Math.sin((timeMs / 1000) * cfg.pulse_frequency_hz * Math.PI * 2);
radius=cfg.blur_radius_px * (0.4 + 0.6 * osc);
}
if(radius <= 0.2 || layerOpacity <= 0.003) return;
const patch=cfg.coverage === "patch";
const pcx=cfg.patch_x * width;
const pcy=cfg.patch_y * height;
const pr=(cfg.patch_radius_percent / 100) * width;
const canFilter=supportsCanvasFilter();

ctx.save();
ctx.globalAlpha=layerOpacity;

if(patch){
ctx.beginPath();
ctx.arc(pcx, pcy, pr, 0, Math.PI * 2);
ctx.clip();
}
if(cfg.blur_type === "motion" || !canFilter){
this.drawMotion(frame, radius, canFilter);
}else if(cfg.blur_type === "radial"){
this.drawRadial(frame, radius, patch ? pcx : width / 2, patch ? pcy : height / 2,
patch ? pr : Math.hypot(width, height) / 2);
}else{

ctx.filter=`blur(${radius}px)`;
ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
ctx.filter="none";
}

ctx.restore();
}
private drawMotion(frame: FrameContext, radius: number, canFilter: boolean): void {
const { ctx, canvas, width, height }=frame;
const steps=7;
const span=radius * 1.6;
ctx.save();
ctx.globalAlpha=(ctx.globalAlpha || 1) / steps;
if(canFilter) ctx.filter = `blur(${Math.max(0.5, radius * 0.25)}px)`;
for(let k = 0; k < steps; k++){
const offset=-span / 2 + (span * k) / (steps - 1);
ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, offset, 0, width, height);
}
ctx.filter="none";
ctx.restore();
}

private drawRadial(
frame: FrameContext,
radius: number,
cx: number,
cy: number,
maxR: number,
): void {
const { ctx, canvas, width, height }=frame;
const buf=this.ensureBuffer(canvas.width, canvas.height);
const bctx=buf.getContext("2d")!;
bctx.setTransform(1, 0, 0, 1, 0, 0);
bctx.clearRect(0, 0, buf.width, buf.height);
bctx.filter=`blur(${radius}px)`;
bctx.drawImage(canvas, 0, 0);
bctx.filter="none";

const grad=bctx.createRadialGradient(
cx * (buf.width / width), cy * (buf.height / height), 0,
cx * (buf.width / width), cy * (buf.height / height), maxR * (buf.width / width),
);
grad.addColorStop(0, "rgba(0,0,0,1)");
grad.addColorStop(0.6, "rgba(0,0,0,0.85)");
grad.addColorStop(1, "rgba(0,0,0,0)");
bctx.globalCompositeOperation="destination-in";
bctx.fillStyle=grad;
bctx.fillRect(0, 0, buf.width, buf.height);
bctx.globalCompositeOperation="source-over";
ctx.drawImage(buf, 0, 0, buf.width, buf.height, 0, 0, width, height);
}
private ensureBuffer(w: number, h: number): HTMLCanvasElement {
if(!this.buffer) this.buffer = document.createElement("canvas");
const c=this.buffer;
if(c.width !== w || c.height !== h){
c.width=w;
c.height=h;
}
return c;
}
}
