import type { FrameContext, LayerRenderer } from "../types";
import type { OscillopsiaConfig } from "../../types/layers";
export class OscillopsiaRenderer implements LayerRenderer {
private cfg: OscillopsiaConfig;
private snapshot: HTMLCanvasElement | null = null;
constructor(cfg: OscillopsiaConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as OscillopsiaConfig;
}
dispose(): void {
this.snapshot=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, timeMs }=frame;
const cfg=this.cfg;
if(cfg.amplitude_px <= 0 || cfg.frequency_hz <= 0) return;
const phase=2 * Math.PI * cfg.frequency_hz * (timeMs / 1000);
const a=cfg.amplitude_px;
let dx=0;
let dy=0;
let rot=0;
const minDim=Math.min(width, height);
const rotPeak=a / (minDim / 2);
switch(cfg.motion_type){
case "horizontal":
dx=a * Math.sin(phase);
break;
case "vertical":
dy=a * Math.sin(phase);
break;
case "rotational":
rot=rotPeak * Math.sin(phase);
break;
case "combined":

dx=a * 0.7 * Math.sin(phase);
dy=a * 0.7 * Math.sin(phase * 1.31 + 0.9);
rot=rotPeak * 0.4 * Math.sin(phase * 0.77);
break;
}
if(!this.snapshot) this.snapshot = document.createElement("canvas");
const snap=this.snapshot;
if(snap.width !== canvas.width || snap.height !== canvas.height){
snap.width=canvas.width;
snap.height=canvas.height;
}
const sctx=snap.getContext("2d")!;
sctx.clearRect(0, 0, snap.width, snap.height);
sctx.drawImage(canvas, 0, 0);
const scale=1 + (2 * a) / minDim + Math.abs(rotPeak) * 0.5;
ctx.save();
ctx.globalAlpha=layerOpacity;
ctx.translate(width / 2 + dx, height / 2 + dy);
ctx.rotate(rot);
ctx.scale(scale, scale);
ctx.drawImage(
snap,
0, 0, snap.width, snap.height,
-width / 2, -height / 2, width, height,
);
ctx.restore();
}
}
