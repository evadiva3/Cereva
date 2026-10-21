import { getRainbowColor } from "../colorModes";
const SPECTRUM_HSL: ReadonlyArray<readonly [number, number, number]>=[
[0, 100, 60],
[60, 100, 65],
[120, 100, 45],
[220, 100, 60],
];
export function drawChromaticFringe(
ctx: CanvasRenderingContext2D,
path: Path2D,
width: number,
mode: string,
color: string,
timeMs: number,
opts: { opacity?: number; cycleSpeed?: number } = {},
): void {
const opacity=opts.opacity ?? 0.45;
if(opacity <= 0.004 || width <= 0) return;
ctx.save();
ctx.lineJoin="round";
ctx.lineCap="round";

if(mode === "spectrum"){
const step=Math.max(1, width * 0.5);
const diag=Math.SQRT1_2;
ctx.globalCompositeOperation="screen";
ctx.lineWidth=Math.max(1, width * 0.75);
ctx.globalAlpha=opacity * (1.4 / SPECTRUM_HSL.length);
for(let i = 0; i < SPECTRUM_HSL.length; i++){
const [h, s, l]=SPECTRUM_HSL[i];
const d=(i - (SPECTRUM_HSL.length - 1) / 2) * step * diag;
ctx.save();
ctx.translate(d, d);
ctx.strokeStyle=`hsl(${h}, ${s}%, ${l}%)`;
ctx.stroke(path);
ctx.restore();
}
}else{
const css =
mode === "rainbow" ? getRainbowColor(timeMs / 1000, opts.cycleSpeed ?? 1) : color;
ctx.strokeStyle=css;
ctx.shadowColor=css;
ctx.shadowBlur=width * 2;
ctx.lineWidth=width;
ctx.globalAlpha=opacity;
ctx.stroke(path);
}
ctx.restore();
}
