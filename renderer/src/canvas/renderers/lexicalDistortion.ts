import { mulberry32, type FrameContext, type LayerRenderer } from "../types";
import type { LexicalDistortionConfig } from "../../types/layers";
import { hslToRgbTuple, mixRgb, type RGB } from "../utils/color";
import {
getReadingPassageWordBoxes,
type WordBox,
} from "../backgrounds/readingPassage";
const FADE_IN_MS=150;
const FADE_OUT_MS=200;
const MAX_STAGGER_MS=180;
const INK: RGB=[17, 17, 17];
const PAPER: RGB=[255, 255, 255];
const SPECTRUM_HUES=[0, 30, 60, 120, 210, 250, 285];
interface ActiveWord {
index: number;
activatedAt: number;
pendingDelay: number;
hue: number;
}
export class LexicalDistortionRenderer implements LayerRenderer {
private cfg: LexicalDistortionConfig;
private boxes: WordBox[] = [];
private boxesKey = "";
private active: ActiveWord[] = [];
private lastSpawnMs = -Infinity;
private spectrumCursor = 0;
private rand = mulberry32(0x1e81ca1);
constructor(cfg: LexicalDistortionConfig){
this.cfg=cfg;
}
update(config: unknown): void {
this.cfg=config as LexicalDistortionConfig;
}
dispose(): void {
this.boxes=[];
this.active=[];
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
if(layerOpacity <= 0.003) return;

if(frame.backgroundType !== "reading_passage"){
this.active=[];
return;
}
const key=`${width}x${height}`;
if(key !== this.boxesKey){
this.boxesKey=key;
this.boxes=getReadingPassageWordBoxes(width, height);
this.active=[];
}
if(this.boxes.length === 0) return;

const mode =
cfg.text_mode ??
(cfg.highlight_mode === "color" ? "color_only" : cfg.highlight_mode);

const interval=1000 / Math.max(0.05, cfg.words_per_second);
if(timeMs - this.lastSpawnMs >= interval){
this.lastSpawnMs=Math.max(this.lastSpawnMs + interval, timeMs - interval);
const target=Math.max(1, cfg.simultaneous_words);
while(this.active.length < target){
if(!this.activateWord(timeMs)) break;
}
}

const lifeMs=Math.max(FADE_IN_MS + FADE_OUT_MS + 50, cfg.duration_ms);
const survivors: ActiveWord[]=[];
for(const a of this.active){
const elapsed=timeMs - (a.activatedAt + a.pendingDelay);
if(elapsed >= lifeMs) continue;
survivors.push(a);
if(elapsed < 0) continue;
const fadeIn=Math.min(1, elapsed / FADE_IN_MS);
const linear=Math.min(1, (lifeMs - elapsed) / FADE_OUT_MS);
const fadeOut=linear * linear * (3 - 2 * linear);
const t=fadeIn * fadeOut;
const box=this.boxes[a.index];
if(!box) continue;
const sat=Math.max(0, Math.min(1, cfg.intensity));
ctx.save();
ctx.globalAlpha=layerOpacity;
if(mode === "highlight" || mode === "both"){
ctx.globalCompositeOperation="multiply";
const [r, g, b]=mixRgb(PAPER, hslToRgbTuple(a.hue, sat, 0.72), t);
ctx.fillStyle=`rgb(${r},${g},${b})`;
ctx.fillRect(
box.x - 2,
box.y - box.fontPx * 0.82,
box.w + 4,
box.fontPx * 1.12,
);
}
if(mode === "color_only" || mode === "both"){
ctx.globalCompositeOperation="source-over";
const [r, g, b]=mixRgb(INK, hslToRgbTuple(a.hue, sat, 0.45), t);
ctx.fillStyle=`rgb(${r},${g},${b})`;
ctx.font=box.font;
ctx.textBaseline="alphabetic";
ctx.fillText(box.word, box.x, box.y);
}
ctx.restore();
}
this.active=survivors;
}

private activateWord(timeMs: number): boolean {
const taken=new Set(this.active.map((a) => a.index));
if(taken.size >= this.boxes.length) return false;
let index=Math.floor(this.rand() * this.boxes.length);
for(let tries = 0; taken.has(index) && tries < 20; tries++){
index=Math.floor(this.rand() * this.boxes.length);
}
if(taken.has(index)) return false;
let hue: number;
switch(this.cfg.color_palette){
case "warm":
hue=this.rand() * 60;
break;
case "cool":
hue=200 + this.rand() * 80;
break;
case "spectrum":
hue=SPECTRUM_HUES[this.spectrumCursor % SPECTRUM_HUES.length];
this.spectrumCursor++;
break;
default:
hue=this.rand() * 360;
}
this.active.push({
index,
activatedAt: timeMs,
pendingDelay: this.rand() * MAX_STAGGER_MS,
hue,
});
return true;
}
}
