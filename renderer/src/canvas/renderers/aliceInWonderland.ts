import { supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { AliceInWonderlandConfig } from "../../types/layers";
import { drawChromaticFringe } from "../utils/chromaticFringe";
const MAX_SCALE=1.8;
const FEATHER_PX=25;
const ABERRATION_PX=1.5;
const BREATHE_PX=3;
const BREATHE_HZ=0.2;
export class AliceInWonderlandRenderer implements LayerRenderer {
private cfg: AliceInWonderlandConfig;
private lens: HTMLCanvasElement | null = null;
private chroma: HTMLCanvasElement | null = null;
private channel: HTMLCanvasElement | null = null;
constructor(cfg: AliceInWonderlandConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as AliceInWonderlandConfig;
}
dispose(): void {
this.lens=null;
this.chroma=null;
this.channel=null;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height, dpr, timeMs }=frame;
const cfg=this.cfg;
if(layerOpacity <= 0.003 || cfg.intensity <= 0.01) return;
const cx=cfg.center_x * width;
const cy=cfg.center_y * height;
const t=timeMs / 1000;
const r =
(cfg.radius_percent / 100) * Math.min(width, height) +
BREATHE_PX * Math.sin(t * BREATHE_HZ * Math.PI * 2);
if(r < 4) return;
const breathe=1 + 0.04 * Math.sin(t);
const strength=1 + (MAX_SCALE - 1) * cfg.intensity * breathe;
const scale=cfg.distortion_type === "macropsia" ? strength : 1 / strength;
const box=Math.ceil(r * 2 * dpr);
if(!this.lens) this.lens = document.createElement("canvas");
if(this.lens.width !== box || this.lens.height !== box){
this.lens.width=box;
this.lens.height=box;
}
const lctx=this.lens.getContext("2d")!;
lctx.setTransform(1, 0, 0, 1, 0, 0);
lctx.globalCompositeOperation="source-over";
lctx.clearRect(0, 0, box, box);
const srcHalf=r / scale;
lctx.drawImage(
canvas,
(cx - srcHalf) * dpr,
(cy - srcHalf) * dpr,
srcHalf * 2 * dpr,
srcHalf * 2 * dpr,
0,
0,
box,
box,
);
this.applyChromaticAberration(box, dpr);
const featherStop=Math.max(0, 1 - (FEATHER_PX * dpr) / (box / 2));
const hole=lctx.createRadialGradient(
box / 2, box / 2, 0,
box / 2, box / 2, box / 2,
);
hole.addColorStop(0, "rgba(0,0,0,1)");
hole.addColorStop(featherStop, "rgba(0,0,0,1)");
hole.addColorStop(1, "rgba(0,0,0,0)");
lctx.globalCompositeOperation="destination-in";
lctx.fillStyle=hole;
lctx.fillRect(0, 0, box, box);
ctx.save();
ctx.globalAlpha=layerOpacity;
ctx.drawImage(this.lens, 0, 0, box, box, cx - r, cy - r, r * 2, r * 2);
ctx.restore();

const mode=cfg.color_mode ?? "fixed";
const rim=new Path2D();
rim.arc(cx, cy, r - FEATHER_PX * 0.3, 0, Math.PI * 2);
drawChromaticFringe(ctx, rim, 5, mode, "hsl(262, 34%, 70%)", timeMs, {
opacity: (mode === "spectrum" ? 0.4 : 0.14) * layerOpacity,
cycleSpeed: cfg.rainbow_cycle_speed ?? 1,
});
}
private applyChromaticAberration(box: number, dpr: number): void {
if(!supportsCanvasFilter()) return;
const lens=this.lens!;
if(!this.chroma) this.chroma = document.createElement("canvas");
if(!this.channel) this.channel = document.createElement("canvas");
for(const c of [this.chroma, this.channel]){
if(c.width !== box || c.height !== box){
c.width=box;
c.height=box;
}
}
const acc=this.chroma.getContext("2d")!;
const chan=this.channel.getContext("2d")!;
acc.setTransform(1, 0, 0, 1, 0, 0);
acc.globalCompositeOperation="source-over";
acc.clearRect(0, 0, box, box);
const off=ABERRATION_PX * dpr;
const channels: Array<[string, number]>=[
["#ff0000", -off],
["#00ff00", 0],
["#0000ff", off],
];
for(const [mask, dx] of channels){
chan.setTransform(1, 0, 0, 1, 0, 0);
chan.globalCompositeOperation="source-over";
chan.clearRect(0, 0, box, box);
chan.drawImage(lens, 0, 0);
chan.globalCompositeOperation="multiply";
chan.fillStyle=mask;
chan.fillRect(0, 0, box, box);
chan.globalCompositeOperation="destination-in";
chan.drawImage(lens, 0, 0);
acc.globalCompositeOperation="lighter";
acc.drawImage(this.channel, dx, 0);
}
const lctx=lens.getContext("2d")!;
lctx.globalCompositeOperation="copy";
lctx.drawImage(this.chroma, 0, 0);
lctx.globalCompositeOperation="source-over";
}
}
