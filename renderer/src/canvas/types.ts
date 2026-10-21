import type { BackgroundType } from "../types/background";
export interface FrameContext {

ctx: CanvasRenderingContext2D;

canvas: HTMLCanvasElement;
width: number;
height: number;
dpr: number;
timeMs: number;
dtMs: number;
pointer: { x: number; y: number } | null;
backgroundType: BackgroundType;
}
export interface LayerRenderer {
update(config: unknown): void;
render(frame: FrameContext, layerOpacity: number): void;
dispose?(): void;
}

export function mulberry32(seed: number): () => number {
let a=seed >>> 0;
return () => {
a |= 0;
a=(a + 0x6d2b79f5) | 0;
let t=Math.imul(a ^ (a >>> 15), 1 | a);
t=(t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}
let filterSupport: boolean | null=null;
export function supportsCanvasFilter(): boolean {
if(filterSupport === null){
const ctx=document.createElement("canvas").getContext("2d");
filterSupport=!!ctx && typeof ctx.filter === "string";
}
return filterSupport;
}
