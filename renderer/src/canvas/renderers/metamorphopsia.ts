import type { FrameContext, LayerRenderer } from "../types";
import type { MetamorphopsiaConfig } from "../../types/layers";
import { drawChromaticFringe } from "../utils/chromaticFringe";
const STRIP_PX=4;
export class MetamorphopsiaRenderer implements LayerRenderer {
private cfg: MetamorphopsiaConfig;
private snapshot: HTMLCanvasElement | null = null;
private warp: HTMLCanvasElement | null = null;
constructor(cfg: MetamorphopsiaConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as MetamorphopsiaConfig;
}
dispose(): void {
this.snapshot=null;
this.warp=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, dpr, timeMs }=frame;
const cfg=this.cfg;
if(layerOpacity <= 0.003 || cfg.wave_amplitude_px < 0.25) return;
const patch=cfg.coverage === "patch";
const pcx=cfg.patch_x * width;
const pcy=cfg.patch_y * height;
const pr=(cfg.patch_radius_percent / 100) * width;
const y0=patch ? Math.max(0, pcy - pr) : 0;
const y1=patch ? Math.min(height, pcy + pr) : height;
const bandH=y1 - y0;
if(bandH < STRIP_PX) return;

if(!this.snapshot) this.snapshot = document.createElement("canvas");
const snap=this.snapshot;
if(snap.width !== canvas.width || snap.height !== canvas.height){
snap.width=canvas.width;
snap.height=canvas.height;
}
const sctx=snap.getContext("2d")!;
sctx.globalCompositeOperation="copy";
sctx.drawImage(canvas, 0, 0);
const t=timeMs / 1000;
const omega=(cfg.wave_frequency * Math.PI * 2) / bandH;

let target=ctx;
if(patch){
if(!this.warp) this.warp = document.createElement("canvas");
if(this.warp.width !== canvas.width || this.warp.height !== canvas.height){
this.warp.width=canvas.width;
this.warp.height=canvas.height;
}
const wctx=this.warp.getContext("2d")!;
wctx.save();
wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
wctx.clearRect(0, 0, width, height);
target=wctx;
}else{
ctx.save();
ctx.globalAlpha=layerOpacity;
}
for(let y = y0; y < y1; y += STRIP_PX){
const h=Math.min(STRIP_PX, y1 - y);
const dy=(y + h / 2 - pcy) / pr;
const window=patch ? Math.max(0, 1 - dy * dy) : 1;
if(window <= 0) continue;
const dx=cfg.wave_amplitude_px * window * Math.sin((y - y0) * omega + t * 0.8);
target.drawImage(
snap,
0, y * dpr, canvas.width, h * dpr,
dx, y, width, h,
);
}
if(patch){
const wctx=this.warp!.getContext("2d")!;
const feather=Math.max(10, pr * 0.18);
const mask=wctx.createRadialGradient(
pcx, pcy, Math.max(0, pr - feather),
pcx, pcy, pr,
);
mask.addColorStop(0, "rgba(0,0,0,1)");
mask.addColorStop(1, "rgba(0,0,0,0)");
wctx.globalCompositeOperation="destination-in";
wctx.fillStyle=mask;
wctx.fillRect(0, 0, width, height);
wctx.restore();
ctx.save();
ctx.globalAlpha=layerOpacity;
ctx.drawImage(this.warp!, 0, 0, this.warp!.width, this.warp!.height, 0, 0, width, height);
ctx.restore();

const mode=cfg.color_mode ?? "fixed";
const rim=new Path2D();
rim.arc(pcx, pcy, pr - feather * 0.3, 0, Math.PI * 2);
drawChromaticFringe(ctx, rim, 3, mode, "hsl(265, 30%, 66%)", timeMs, {
opacity: (mode === "spectrum" ? 0.35 : 0.1) * layerOpacity,
cycleSpeed: cfg.rainbow_cycle_speed ?? 1,
});
}else{
ctx.restore();
}
}
}
