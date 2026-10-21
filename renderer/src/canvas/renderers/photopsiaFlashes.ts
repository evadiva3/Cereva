import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { PhotopsiaFlashesConfig } from "../../types/layers";
import { resolveColor } from "../colorModes";
const MAX_FLASHES_PER_MINUTE=180;
const BASE_RADIUS=46;
interface ActiveFlash {
x: number;
y: number;
startMs: number;
}
export class PhotopsiaFlashesRenderer implements LayerRenderer {
private cfg: PhotopsiaFlashesConfig;
private rand = mulberry32(7);
private nextFlashMs = 0;
private pointIndex = 0;
private active: ActiveFlash[] = [];
constructor(cfg: PhotopsiaFlashesConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as PhotopsiaFlashesConfig;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
const fpm=Math.min(cfg.flashes_per_minute, MAX_FLASHES_PER_MINUTE);
if(cfg.flash_points.length === 0 || fpm <= 0) return;

const meanInterval=60000 / fpm;
if(this.nextFlashMs === 0) this.nextFlashMs = timeMs + meanInterval * this.rand();
while(timeMs >= this.nextFlashMs){
const p=cfg.flash_points[this.pointIndex % cfg.flash_points.length];
this.pointIndex++;
this.active.push({ x: p.x * width, y: p.y * height, startMs: this.nextFlashMs });
this.nextFlashMs += meanInterval * (0.75 + 0.5 * this.rand());
}

if(this.active.length === 0) return;
ctx.save();
ctx.globalCompositeOperation="lighter";
const color=resolveColor(cfg, cfg.flash_color, timeMs);
let write=0;
for(const flash of this.active){
const progress=(timeMs - flash.startMs) / cfg.flash_duration_ms;
if(progress >= 1) continue;
this.active[write++] = flash;
const envelope=Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
const radius=BASE_RADIUS * (0.5 + 0.5 * envelope);
const gradient=ctx.createRadialGradient(flash.x, flash.y, 0, flash.x, flash.y, radius);
ctx.globalAlpha=envelope * layerOpacity;
gradient.addColorStop(0, color);
gradient.addColorStop(0.35, color);
gradient.addColorStop(1, "rgba(255,255,255,0)");
ctx.fillStyle=gradient;
ctx.beginPath();
ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
ctx.fill();
}
this.active.length=write;
ctx.restore();
}
}
