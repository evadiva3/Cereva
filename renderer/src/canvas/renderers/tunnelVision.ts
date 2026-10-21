import { supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { TunnelVisionConfig } from "../../types/layers";
import { drawChromaticFringe } from "../utils/chromaticFringe";
const BLUR_PX=12;
const PULSE_PX=2;
const PULSE_HZ=0.3;
export class TunnelVisionRenderer implements LayerRenderer {
private cfg: TunnelVisionConfig;
private blurCanvas: HTMLCanvasElement | null = null;
constructor(cfg: TunnelVisionConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as TunnelVisionConfig;
}
dispose(): void {
this.blurCanvas=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
const cx=width / 2;
const cy=height / 2;

const canvasRadius=Math.hypot(width, height) / 2;
const pulse=PULSE_PX * Math.sin((timeMs / 1000) * PULSE_HZ * Math.PI * 2);
const clearRadius=Math.max(0, (cfg.radius_percent / 100) * canvasRadius + pulse);
const soft=Math.max(1, cfg.edge_softness_px);
const outer=clearRadius + soft;
if(cfg.fill_style === "blur" && supportsCanvasFilter()){
this.renderBlur(frame, layerOpacity, cx, cy, clearRadius, outer);
}else{

const a=layerOpacity;
const gradient=ctx.createRadialGradient(cx, cy, clearRadius, cx, cy, outer);
gradient.addColorStop(0, "rgba(0,0,0,0)");
gradient.addColorStop(0.35, `rgba(34,10,4,${(0.38 * a).toFixed(3)})`);
gradient.addColorStop(0.7, `rgba(8,12,34,${(0.78 * a).toFixed(3)})`);
gradient.addColorStop(1, `rgba(0,0,0,${a.toFixed(3)})`);
ctx.save();
ctx.fillStyle=gradient;
ctx.fillRect(0, 0, width, height);
ctx.restore();
}
const mode=cfg.color_mode ?? "fixed";
const ring=new Path2D();
ring.arc(cx, cy, clearRadius, 0, Math.PI * 2);
drawChromaticFringe(ctx, ring, 5, mode, "hsl(258, 32%, 68%)", timeMs, {
opacity: (mode === "spectrum" ? 0.45 : 0.16) * layerOpacity,
cycleSpeed: cfg.rainbow_cycle_speed ?? 1,
});
}
private renderBlur(
frame: FrameContext,
layerOpacity: number,
cx: number,
cy: number,
clearRadius: number,
outer: number,
): void {
const { ctx, canvas, width, height, dpr }=frame;
if(!this.blurCanvas) this.blurCanvas = document.createElement("canvas");
const off=this.blurCanvas;
if(off.width !== canvas.width || off.height !== canvas.height){
off.width=canvas.width;
off.height=canvas.height;
}
const octx=off.getContext("2d")!;

octx.save();
octx.setTransform(dpr, 0, 0, dpr, 0, 0);
octx.clearRect(0, 0, width, height);
octx.filter=`blur(${BLUR_PX}px)`;
octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
octx.filter="none";
octx.globalCompositeOperation="destination-out";
const hole=octx.createRadialGradient(cx, cy, Math.max(0, clearRadius), cx, cy, outer);
hole.addColorStop(0, "rgba(0,0,0,1)");
hole.addColorStop(1, "rgba(0,0,0,0)");
octx.fillStyle=hole;
octx.fillRect(0, 0, width, height);
octx.restore();
ctx.save();
ctx.globalAlpha=layerOpacity;
ctx.drawImage(off, 0, 0, off.width, off.height, 0, 0, width, height);
ctx.restore();
}
}
