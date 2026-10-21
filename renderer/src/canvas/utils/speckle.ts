import { mulberry32 } from "../types";
export const SPECKLE_TILE_SIZE=96;
export function makeSpeckleTile(
seed: number,
density: number,
tint: readonly [number, number, number] = [255, 244, 255],
): HTMLCanvasElement {
const tile=document.createElement("canvas");
tile.width=SPECKLE_TILE_SIZE;
tile.height=SPECKLE_TILE_SIZE;
const ctx=tile.getContext("2d")!;
const rand=mulberry32(seed);
const img=ctx.createImageData(SPECKLE_TILE_SIZE, SPECKLE_TILE_SIZE);
for(let i = 0; i < img.data.length; i += 4){
if(rand() < density){
const v=120 + rand() * 100;
img.data[i]=Math.min(255, (v * tint[0]) / 255) | 0;
img.data[i + 1] = Math.min(255, (v * tint[1]) / 255) | 0;
img.data[i + 2] = Math.min(255, (v * tint[2]) / 255) | 0;
img.data[i + 3] = (60 + rand() * 90) | 0;
}
}
ctx.putImageData(img, 0, 0);
return tile;
}
