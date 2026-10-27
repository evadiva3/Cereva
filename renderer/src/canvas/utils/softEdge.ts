import { supportsCanvasFilter } from "../types";
export type FillFn=(ctx: CanvasRenderingContext2D) => void;
let contentCanvas: HTMLCanvasElement | null=null;
let maskCanvas: HTMLCanvasElement | null=null;
function scratch(which: "content" | "mask", w: number, h: number): CanvasRenderingContext2D {
let canvas=which === "content" ? contentCanvas : maskCanvas;
if(!canvas){
canvas=document.createElement("canvas");
if(which === "content") contentCanvas = canvas;
else maskCanvas = canvas;
}
if(canvas.width < w) canvas.width = Math.ceil(w);
if(canvas.height < h) canvas.height = Math.ceil(h);
const ctx=canvas.getContext("2d")!;
ctx.setTransform(1, 0, 0, 1, 0, 0);
ctx.globalCompositeOperation="source-over";
ctx.globalAlpha=1;
ctx.filter="none";
ctx.clearRect(0, 0, canvas.width, canvas.height);
return ctx;
}
export function drawSoftCircle(
ctx: CanvasRenderingContext2D,
x: number,
y: number,
radius: number,
feather: number,
fillFn: FillFn,
): void {
if(radius <= 0) return;
const f=Math.min(Math.max(0.5, feather), radius);
const box=Math.ceil(radius * 2 + 4);
const cctx=scratch("content", box, box);
cctx.save();
cctx.setTransform(1, 0, 0, 1, box / 2 - x, box / 2 - y);
fillFn(cctx);
cctx.restore();
const mask=cctx.createRadialGradient(
box / 2, box / 2, Math.max(0, radius - f),
box / 2, box / 2, radius,
);
mask.addColorStop(0, "rgba(0,0,0,1)");
mask.addColorStop(1, "rgba(0,0,0,0)");
cctx.globalCompositeOperation="destination-in";
cctx.fillStyle=mask;
cctx.fillRect(0, 0, box, box);
cctx.globalCompositeOperation="source-over";
ctx.drawImage(
cctx.canvas,
0, 0, box, box,
Math.round(x - box / 2), Math.round(y - box / 2), box, box,
);
}
export function drawSoftPath(
ctx: CanvasRenderingContext2D,
pathPoints: ReadonlyArray<{ x: number; y: number }>,
feather: number,
fillFn: FillFn,
): void {
if(pathPoints.length < 3) return;
const f=Math.max(0.5, feather);
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for(const p of pathPoints){
minX=Math.min(minX, p.x);
minY=Math.min(minY, p.y);
maxX=Math.max(maxX, p.x);
maxY=Math.max(maxY, p.y);
}
const pad=Math.ceil(f + 2);
const ox=Math.floor(minX) - pad;
const oy=Math.floor(minY) - pad;
const bw=Math.ceil(maxX - minX) + pad * 2;
const bh=Math.ceil(maxY - minY) + pad * 2;
if(bw <= 0 || bh <= 0) return;
const cctx=scratch("content", bw, bh);
cctx.save();
cctx.setTransform(1, 0, 0, 1, -ox, -oy);
fillFn(cctx);
cctx.restore();
const mctx=scratch("mask", bw, bh);
mctx.save();
mctx.setTransform(1, 0, 0, 1, -ox, -oy);
if(supportsCanvasFilter()) mctx.filter = `blur(${f / 2}px)`;
mctx.fillStyle="#fff";
mctx.beginPath();
pathPoints.forEach((p, i) => (i === 0 ? mctx.moveTo(p.x, p.y) : mctx.lineTo(p.x, p.y)));
mctx.closePath();
mctx.fill();
mctx.restore();
cctx.globalCompositeOperation="destination-in";
cctx.drawImage(mctx.canvas, 0, 0, bw, bh, 0, 0, bw, bh);
cctx.globalCompositeOperation="source-over";
ctx.drawImage(cctx.canvas, 0, 0, bw, bh, ox, oy, bw, bh);
}
