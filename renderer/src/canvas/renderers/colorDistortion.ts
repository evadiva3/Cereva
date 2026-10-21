import { supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { ColorDistortionConfig, Quadrant } from "../../types/layers";
export class ColorDistortionRenderer implements LayerRenderer {
private cfg: ColorDistortionConfig;
private scratch: HTMLCanvasElement | null = null;
constructor(cfg: ColorDistortionConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as ColorDistortionConfig;
}
dispose(): void {
this.scratch=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const cfg=this.cfg;
const t=frame.timeMs / 1000;

let mix=1;
if(cfg.pattern === "pulsing"){
mix=0.5 + 0.5 * Math.sin(t * cfg.pulse_speed * Math.PI * 2);
}
const hue=cfg.hue_shift * mix;
const sat=1 + (cfg.saturation_boost - 1) * mix;
const con=1 + (cfg.contrast - 1) * mix;
if(Math.abs(hue) < 0.5 && Math.abs(sat - 1) < 0.01 && Math.abs(con - 1) < 0.01){
return;
}
if(supportsCanvasFilter()){
this.renderFiltered(frame, layerOpacity, hue, sat, con);
}else{
this.renderFallback(frame, layerOpacity, hue, sat);
}
}

private renderFiltered(
frame: FrameContext,
layerOpacity: number,
hue: number,
sat: number,
con: number,
): void {
const { ctx, canvas, width, height }=frame;
const scratch=this.ensureScratch(canvas.width, canvas.height);
const sctx=scratch.getContext("2d")!;
sctx.globalCompositeOperation="copy"; 
sctx.drawImage(canvas, 0, 0);

ctx.save();
if(this.cfg.pattern === "quadrant"){
clipQuadrant(ctx, this.cfg.quadrant, width, height);
}
ctx.globalAlpha=layerOpacity;
ctx.filter=`hue-rotate(${hue}deg) saturate(${sat}) contrast(${con})`;
ctx.drawImage(scratch, 0, 0, scratch.width, scratch.height, 0, 0, width, height);
ctx.restore();
}
private renderFallback(
frame: FrameContext,
layerOpacity: number,
hue: number,
sat: number,
): void {
const { ctx, width, height }=frame;
ctx.save();
if(this.cfg.pattern === "quadrant"){
clipQuadrant(ctx, this.cfg.quadrant, width, height);
}
if(Math.abs(hue) >= 0.5){
ctx.globalCompositeOperation="hue";
ctx.globalAlpha=layerOpacity * Math.min(1, Math.abs(hue) / 180 + 0.25);
ctx.fillStyle=`hsl(${(hue + 360) % 360}, 100%, 50%)`;
ctx.fillRect(0, 0, width, height);
}
if(sat < 0.99){
ctx.globalCompositeOperation="saturation";
ctx.globalAlpha=layerOpacity * (1 - sat);
ctx.fillStyle="hsl(0, 0%, 50%)";
ctx.fillRect(0, 0, width, height);
}
ctx.restore();
}
private ensureScratch(w: number, h: number): HTMLCanvasElement {
if(!this.scratch) this.scratch = document.createElement("canvas");
if(this.scratch.width !== w || this.scratch.height !== h){
this.scratch.width=w;
this.scratch.height=h;
}
return this.scratch;
}
}
function clipQuadrant(
ctx: CanvasRenderingContext2D,
quadrant: Quadrant,
width: number,
height: number,
): void {
const halfW=width / 2;
const halfH=height / 2;
const x=quadrant === "top_right" || quadrant === "bottom_right" ? halfW : 0;
const y=quadrant === "bottom_left" || quadrant === "bottom_right" ? halfH : 0;
ctx.beginPath();
ctx.rect(x, y, halfW, halfH);
ctx.clip();
}
