const TOP: readonly [number, number, number]=[18, 18, 22];
const BOTTOM: readonly [number, number, number]=[9, 9, 12];
const DITHER=1.5;
export function paintNeutralField(
ctx: CanvasRenderingContext2D,
width: number,
height: number,
): void {
const g=ctx.createLinearGradient(0, 0, 0, height);
g.addColorStop(0, `rgb(${TOP[0]},${TOP[1]},${TOP[2]})`);
g.addColorStop(1, `rgb(${BOTTOM[0]},${BOTTOM[1]},${BOTTOM[2]})`);
ctx.fillStyle=g;
ctx.fillRect(0, 0, width, height);
const step=2;
ctx.save();
for(let y = 0; y < height; y += step){
for(let x = 0; x < width; x += step){
const h=((x * 73856093) ^ (y * 19349663)) >>> 0;
const n=((h % 1000) / 1000 - 0.5) * 2 * DITHER;
if(n <= 0) continue;
ctx.fillStyle=`rgba(255,255,255,${(n / 255).toFixed(4)})`;
ctx.fillRect(x, y, step, step);
}
}
ctx.restore();
}
