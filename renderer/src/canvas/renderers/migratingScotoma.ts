import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { MigratingScotomaConfig } from "../../types/layers";
import { drawSoftCircle } from "../utils/softEdge";
import { hexToRgb } from "../utils/color";
const BASE_SEED=0x315c07;
const DRIFT_PX_PER_SEC=40;
const ERRATIC_PX_PER_SEC=55;
const SWARM_SPREAD_PX=40;
interface Dot {
nx: number;
ny: number;
phaseOffset: number;
noiseSeedX: number;
noiseSeedY: number;
}

export class MigratingScotomaRenderer implements LayerRenderer {
private cfg: MigratingScotomaConfig;
private dots: Dot[] = [];
private dotKey = -1;
private orbitPhase = 0;
private swarmSeedX = 0;
private swarmSeedY = 0;
constructor(cfg: MigratingScotomaConfig){
this.cfg=cfg;
const rand=mulberry32(BASE_SEED ^ 0x9e37);
this.swarmSeedX=Math.floor(rand() * 0xffffffff);
this.swarmSeedY=Math.floor(rand() * 0xffffffff);
}
update(config: unknown): void {
this.cfg=config as MigratingScotomaConfig;
}
dispose(): void {
this.dots=[];
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs, dtMs }=frame;
const cfg=this.cfg;
const alpha=cfg.opacity * layerOpacity;
if(alpha <= 0.003) return;

this.ensureDots();
const t=timeMs / 1000;
const dt=Math.min(dtMs / 1000, 0.1);
const speed =
cfg.path_type === "crawl"
? Math.min(cfg.speed, 1) * 0.15
: cfg.speed;
const radius=Math.max(1, cfg.dot_size_px);
const feather=Math.min(radius, Math.max(0.5, cfg.edge_softness_px));

this.orbitPhase += dt * speed * 0.6;
const [fr, fg, fb]=hexToRgb(cfg.fill_color, [10, 5, 16]);
const fillCss=`rgba(${fr | 0},${fg | 0},${fb | 0},1)`;
const swarmX=valueNoise(t * 0.25 * speed, this.swarmSeedX);
const swarmY=valueNoise(t * 0.25 * speed, this.swarmSeedY);

for(let i = 0; i < this.dots.length; i++){
const dot=this.dots[i];
let px: number;
let py: number;
if(cfg.path_type === "orbit"){
const orbitR=(cfg.orbit_radius_percent / 100) * Math.min(width, height);
const angle=this.orbitPhase + dot.phaseOffset;
px=width / 2 + Math.cos(angle) * orbitR;
py=height / 2 + Math.sin(angle) * orbitR;
}else if(cfg.path_type === "erratic"){
dot.nx += ((valueNoise(t * 0.4, dot.noiseSeedX) - 0.5) * 2 * ERRATIC_PX_PER_SEC * speed * dt) / width;
dot.ny += ((valueNoise(t * 0.4, dot.noiseSeedY) - 0.5) * 2 * ERRATIC_PX_PER_SEC * speed * dt) / height;
this.wrap(dot, radius, width, height);
px=dot.nx * width;
py=dot.ny * height;
}else if(cfg.path_type === "swarm"){
const cx=(0.2 + swarmX * 0.6) * width;
const cy=(0.2 + swarmY * 0.6) * height;
px=cx + (valueNoise(t * 0.5 + i * 3.7, dot.noiseSeedX) - 0.5) * 2 * SWARM_SPREAD_PX;
py=cy + (valueNoise(t * 0.5 + i * 3.7, dot.noiseSeedY) - 0.5) * 2 * SWARM_SPREAD_PX;
}else{
const angle=(cfg.drift_angle * Math.PI) / 180;
dot.nx += (Math.cos(angle) * DRIFT_PX_PER_SEC * speed * dt) / width;
dot.ny += (Math.sin(angle) * DRIFT_PX_PER_SEC * speed * dt) / height;
this.wrap(dot, radius, width, height);
px=dot.nx * width;
py=dot.ny * height;
}
drawSoftCircle(ctx, px, py, radius, feather, (fctx) => {
fctx.save();
fctx.globalAlpha=alpha;
fctx.fillStyle=fillCss;
fctx.fillRect(px - radius - 2, py - radius - 2, radius * 2 + 4, radius * 2 + 4);
fctx.restore();
});
}
}
private wrap(dot: Dot, radius: number, width: number, height: number): void {
const mx=radius / width;
const my=radius / height;
if(dot.nx < -mx) dot.nx += 1 + 2 * mx;
else if(dot.nx > 1 + mx) dot.nx -= 1 + 2 * mx;
if(dot.ny < -my) dot.ny += 1 + 2 * my;
else if(dot.ny > 1 + my) dot.ny -= 1 + 2 * my;
}

private ensureDots(): void {
const count=Math.max(1, Math.min(12, Math.round(this.cfg.dot_count)));
if(count === this.dotKey) return;
this.dotKey=count;
const previous=this.dots;
this.dots=[];
for(let i = 0; i < count; i++){
const rand=mulberry32(BASE_SEED + i * 7919);
const dot: Dot={
nx: 0.1 + rand() * 0.8,
ny: 0.1 + rand() * 0.8,
phaseOffset: (i / count) * Math.PI * 2 + rand() * 0.3,
noiseSeedX: Math.floor(rand() * 0xffffffff),
noiseSeedY: Math.floor(rand() * 0xffffffff),
};
const old=previous[i];
if(old){
dot.nx=old.nx;
dot.ny=old.ny;
}
this.dots.push(dot);
}
}
}
function hash01(seed: number, i: number): number {
let h=(seed ^ Math.imul(i, 0x9e3779b1)) >>> 0;
h=Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
h=Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function valueNoise(t: number, seed: number): number {
const i=Math.floor(t);
const fr=t - i;
const s=fr * fr * (3 - 2 * fr);
return hash01(seed, i) * (1 - s) + hash01(seed, i + 1) * s;
}
