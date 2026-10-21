import { supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { HemianopiaMaskConfig } from "../../types/layers";
import { drawChromaticFringe } from "../utils/chromaticFringe";
const FILL="26,26,30";
const BLACKOUT_THRESHOLD=0.7;
const MIN_SOFT_PX=8;
export class HemianopiaMaskRenderer implements LayerRenderer {
private cfg: HemianopiaMaskConfig;
private ghost: HTMLCanvasElement | null = null;
constructor(cfg: HemianopiaMaskConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as HemianopiaMaskConfig;
}
dispose(): void {
this.ghost=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
if(cfg.fill_opacity * layerOpacity <= 0.003) return;

const mid=width / 2;
const soft=Math.max(MIN_SOFT_PX, cfg.edge_softness_px);
if(cfg.fill_opacity > BLACKOUT_THRESHOLD || !supportsCanvasFilter()){
this.renderBlackout(frame, layerOpacity, mid, soft);
}else{
this.renderGhost(frame, layerOpacity, mid, soft);
}
const mode=cfg.color_mode ?? "fixed";
const seam=new Path2D();
seam.moveTo(mid, 0);
seam.lineTo(mid, height);
drawChromaticFringe(ctx, seam, 4, mode, cfg.edge_color ?? "#c9c2ec", timeMs, {
opacity: (mode === "spectrum" ? 0.4 : 0.15) * layerOpacity,
cycleSpeed: cfg.rainbow_cycle_speed ?? 1,
});
}
private renderGhost(
frame: FrameContext,
layerOpacity: number,
mid: number,
soft: number,
): void {
const { ctx, canvas, width, height, dpr }=frame;
const cfg=this.cfg;
if(!this.ghost) this.ghost = document.createElement("canvas");
const off=this.ghost;
if(off.width !== canvas.width || off.height !== canvas.height){
off.width=canvas.width;
off.height=canvas.height;
}
const octx=off.getContext("2d")!;
octx.save();
octx.setTransform(dpr, 0, 0, dpr, 0, 0);
octx.clearRect(0, 0, width, height);
octx.filter="saturate(0.15) brightness(0.4)";
octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
octx.filter="none";

const from=cfg.side === "left" ? mid - soft / 2 : mid + soft / 2;
const to=cfg.side === "left" ? mid + soft / 2 : mid - soft / 2;
const mask=octx.createLinearGradient(from, 0, to, 0);
mask.addColorStop(0, "rgba(0,0,0,1)");
mask.addColorStop(1, "rgba(0,0,0,0)");
octx.globalCompositeOperation="destination-in";
octx.fillStyle=mask;
octx.fillRect(0, 0, width, height);
octx.restore();
const strength=Math.min(1, cfg.fill_opacity / BLACKOUT_THRESHOLD) * layerOpacity;
ctx.save();
ctx.globalAlpha=strength;
ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, width, height);
ctx.restore();
}
private renderBlackout(
frame: FrameContext,
layerOpacity: number,
mid: number,
soft: number,
): void {
const { ctx, width, height }=frame;
const cfg=this.cfg;
const alpha=cfg.fill_opacity * layerOpacity;
const from=cfg.side === "left" ? mid - soft / 2 : mid + soft / 2;
const to=cfg.side === "left" ? mid + soft / 2 : mid - soft / 2;
const gradient=ctx.createLinearGradient(from, 0, to, 0);
gradient.addColorStop(0, `rgba(${FILL},${alpha.toFixed(3)})`);
gradient.addColorStop(1, `rgba(${FILL},0)`);
ctx.save();
ctx.fillStyle=gradient;
ctx.fillRect(0, 0, width, height);
ctx.restore();
}
}
