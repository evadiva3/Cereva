import { GIFEncoder, quantize, applyPalette } from "gifenc";

export interface GifRequest {
frames: number;
fps: number;
scale: number;
}

export interface GifResult {
dataUrl: string;
width: number;
height: number;
frames: number;
}

const MAX_EDGE=480;

function target(canvas: HTMLCanvasElement, scale: number){
let w=Math.max(1, Math.round(canvas.width * scale));
let h=Math.max(1, Math.round(canvas.height * scale));
const longest=Math.max(w, h);
if(longest > MAX_EDGE){
const k=MAX_EDGE / longest;
w=Math.max(1, Math.round(w * k));
h=Math.max(1, Math.round(h * k));
}
return { w, h };
}

function toBase64(bytes: Uint8Array){
let binary="";
const chunk=0x8000;
for(let i = 0; i < bytes.length; i += chunk){
binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
}
return btoa(binary);
}

export async function captureGif(
canvas: HTMLCanvasElement,
request: GifRequest,
): Promise<GifResult> {
const { w, h }=target(canvas, request.scale);

const scratch=document.createElement("canvas");
scratch.width=w;
scratch.height=h;
const ctx=scratch.getContext("2d", { willReadFrequently: true });
if(!ctx) throw new Error("no 2d context for the gif scratch canvas");

const encoder=GIFEncoder();
const delay=Math.max(20, Math.round(1000 / request.fps));

for(let i = 0; i < request.frames; i++){
await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

ctx.clearRect(0, 0, w, h);
ctx.drawImage(canvas, 0, 0, w, h);
const { data }=ctx.getImageData(0, 0, w, h);

const palette=quantize(data, 256, { format: "rgb565" });
const indexed=applyPalette(data, palette, "rgb565");
encoder.writeFrame(indexed, w, h, { palette, delay });
}

encoder.finish();
const bytes=encoder.bytes();

return {
dataUrl: `data:image/gif;base64,${toBase64(bytes)}`,
width: w,
height: h,
frames: request.frames,
};
}
