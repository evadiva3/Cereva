import { paintReadingPassage } from "./backgrounds/readingPassage";
import { paintNeutralField } from "./backgrounds/neutral";
import type { CameraSource } from "./backgrounds/camera";
import { DEFAULT_BACKGROUND, type BackgroundConfig } from "../types/background";
const CAMERA_PENDING_FILL="#0b0b0e";
export class BackgroundRenderer {
private cfg: BackgroundConfig = DEFAULT_BACKGROUND;
private cache: HTMLCanvasElement | null = null;
private cacheKey = "";
private image: HTMLImageElement | null = null;
private imageUri: string | null = null;

private camera: CameraSource | null = null;
setCamera(camera: CameraSource | null): void {
this.camera=camera;
}
setConfig(cfg: BackgroundConfig): void {
this.cfg=cfg;
const uri=cfg.background_type === "photo" ? cfg.photo_uri : null;
if(uri !== this.imageUri){
this.imageUri=uri;
this.image=null;
if(uri){
const img=new Image();
img.onload=() => {
if(this.imageUri === uri){
this.image=img;
this.cacheKey="";
}
};
img.onerror=() => {
if(this.imageUri === uri) this.image = null;
};
img.src=uri;
}
}
}
draw(ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number): void {
if(this.cfg.background_type === "camera"){
const source=this.camera?.frameSource() ?? null;
if(source){
this.drawCover(ctx, source, source.videoWidth, source.videoHeight, width, height);
}else{
ctx.fillStyle=CAMERA_PENDING_FILL;
ctx.fillRect(0, 0, width, height);
}
return;
}
const key=this.keyFor(width, height, dpr);
if(!this.cache || this.cacheKey !== key){
this.rebuild(width, height, dpr, key);
}
ctx.drawImage(this.cache!, 0, 0, width, height);
}
private keyFor(width: number, height: number, dpr: number): string {
const c=this.cfg;
let source: string;
if(c.background_type === "photo"){
source=`photo:${this.image ? "ready" : "pending"}`;
}else{
source=c.background_type;
}
return `${width}x${height}@${dpr}|${source}`;
}
private rebuild(width: number, height: number, dpr: number, key: string): void {
const canvas=document.createElement("canvas");
canvas.width=Math.max(1, Math.round(width * dpr));
canvas.height=Math.max(1, Math.round(height * dpr));
const ctx=canvas.getContext("2d")!;
ctx.scale(dpr, dpr);
const c=this.cfg;
if(c.background_type === "photo"){
if(this.image){
this.drawCover(ctx, this.image, this.image.width, this.image.height, width, height);
}else{
paintNeutralField(ctx, width, height);
}
}else if(c.background_type === "reading_passage"){
paintReadingPassage(ctx, width, height);
}else{
paintNeutralField(ctx, width, height);
}
this.cache=canvas;
this.cacheKey=key;
}
private drawCover(
ctx: CanvasRenderingContext2D,
source: CanvasImageSource,
srcW: number,
srcH: number,
width: number,
height: number,
): void {
if(srcW <= 0 || srcH <= 0) return;
const scale=Math.max(width / srcW, height / srcH);
const dw=srcW * scale;
const dh=srcH * scale;
ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh);
}
}
