import type { FrameContext, LayerRenderer } from "../types";
import type { PhotophobiaConfig } from "../../types/layers";
const DOWNSCALE=8;
const BRIGHT_THRESHOLD=215;
export class PhotophobiaRenderer implements LayerRenderer {
private cfg: PhotophobiaConfig;
private small: HTMLCanvasElement | null = null;
constructor(cfg: PhotophobiaConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as PhotophobiaConfig;
}
dispose(): void {
this.small=null;
}

render(frame: FrameContext, layerOpacity: number): void {
const { ctx, canvas, width, height }=frame;
const cfg=this.cfg;

if(cfg.glare_intensity > 0.01){
this.renderGlare(ctx, canvas, width, height, layerOpacity);
}

if(cfg.luminance_reduction > 0.01){
ctx.save();
ctx.globalAlpha=Math.min(0.92, cfg.luminance_reduction) * layerOpacity;
ctx.fillStyle="#000000";
ctx.fillRect(0, 0, width, height);
ctx.restore();
}
}
private renderGlare(
ctx: CanvasRenderingContext2D,
canvas: HTMLCanvasElement,
width: number,
height: number,
layerOpacity: number,
): void {
const cfg=this.cfg;
const sw=Math.max(1, Math.floor(width / DOWNSCALE));
const sh=Math.max(1, Math.floor(height / DOWNSCALE));
const small=this.ensureSmall(sw, sh);
const sctx=small.getContext("2d", { willReadFrequently: true })!;
sctx.globalCompositeOperation="copy";
sctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, sw, sh);

const img=sctx.getImageData(0, 0, sw, sh);
const data=img.data;
for(let i = 0; i < data.length; i += 4){
const lum=0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
if(lum < BRIGHT_THRESHOLD){
data[i]=data[i + 1] = data[i + 2] = 0;
}else{
const k=(lum - BRIGHT_THRESHOLD) / (255 - BRIGHT_THRESHOLD);
data[i]=(data[i] * k) | 0;
data[i + 1] = (data[i + 1] * k) | 0;
data[i + 2] = (data[i + 2] * k) | 0;
}
data[i + 3] = 255;
}
sctx.putImageData(img, 0, 0);
const spread=cfg.glare_radius * Math.min(width, height);
ctx.save();
ctx.globalCompositeOperation="lighter";
ctx.imageSmoothingEnabled=true;
ctx.globalAlpha=cfg.glare_intensity * layerOpacity * 0.55;
ctx.drawImage(small, -spread, -spread, width + spread * 2, height + spread * 2);
ctx.globalAlpha=cfg.glare_intensity * layerOpacity * 0.3;
ctx.drawImage(small, -spread * 2, -spread * 2, width + spread * 4, height + spread * 4);
ctx.restore();
}
private ensureSmall(w: number, h: number): HTMLCanvasElement {
if(!this.small) this.small = document.createElement("canvas");
if(this.small.width !== w || this.small.height !== h){
this.small.width=w;
this.small.height=h;
}
return this.small;
}
}
