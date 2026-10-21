export type RGB=readonly [number, number, number];
export function hexToRgb(css: string, fallback: RGB = [255, 255, 255]): RGB {
if(typeof css === "string" && /^#[0-9a-fA-F]{6}$/.test(css)){
return [
parseInt(css.slice(1, 3), 16),
parseInt(css.slice(3, 5), 16),
parseInt(css.slice(5, 7), 16),
];
}
return fallback;
}
export function mixRgb(from: RGB, to: RGB, t: number): RGB {
return [
Math.round(from[0] + (to[0] - from[0]) * t),
Math.round(from[1] + (to[1] - from[1]) * t),
Math.round(from[2] + (to[2] - from[2]) * t),
];
}
export function rotateHue(rgb: RGB, degrees: number): RGB {
const [h, s, l]=rgbToHsl(rgb);
return hslToRgbTuple((((h + degrees) % 360) + 360) % 360, s, l);
}
export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
const rn=r / 255,gn=g / 255,bn=b / 255;
const max=Math.max(rn, gn, bn);
const min=Math.min(rn, gn, bn);
const l=(max + min) / 2;
if(max === min) return [0, 0, l];
const d=max - min;
const s=l > 0.5 ? d / (2 - max - min) : d / (max + min);
let h: number;
if(max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
else if(max === gn) h = ((bn - rn) / d + 2) * 60;
else h = ((rn - gn) / d + 4) * 60;
return [h, s, l];
}
export function hslToRgbTuple(h: number, s: number, l: number): RGB {
const c=(1 - Math.abs(2 * l - 1)) * s;
const hp=h / 60;
const x=c * (1 - Math.abs((hp % 2) - 1));
let r=0,g=0,b=0;
if(hp < 1) [r, g, b] = [c, x, 0];
else if(hp < 2) [r, g, b] = [x, c, 0];
else if(hp < 3) [r, g, b] = [0, c, x];
else if(hp < 4) [r, g, b] = [0, x, c];
else if(hp < 5) [r, g, b] = [x, 0, c];
else [r, g, b] = [c, 0, x];
const m=l - c / 2;
return [
Math.round((r + m) * 255),
Math.round((g + m) * 255),
Math.round((b + m) * 255),
];
}
