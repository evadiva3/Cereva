import type { ColorModeFields } from "../types/layers";
type ColorModeLike=Omit<ColorModeFields, "color_mode"> & { color_mode: string };
const RAINBOW_SATURATION=90;
const RAINBOW_LIGHTNESS=52;

export function rainbowHue(
elapsedSeconds: number,
cycleSpeed: number,
hueOffset=0,
): number {
return (((elapsedSeconds * cycleSpeed * 6 + hueOffset) % 360) + 360) % 360;
}

export function getRainbowColor(
elapsedSeconds: number,
cycleSpeed: number,
hueOffset=0,
): string {
const hue=rainbowHue(elapsedSeconds, cycleSpeed, hueOffset);
return `hsl(${hue}, ${RAINBOW_SATURATION}%, ${RAINBOW_LIGHTNESS}%)`;
}
export function resolveColor(
cfg: ColorModeLike,
fixedColor: string,
timeMs: number,
hueOffset=0,
): string {
if(cfg.color_mode !== "rainbow") return fixedColor;
return getRainbowColor(timeMs / 1000, cfg.rainbow_cycle_speed, hueOffset);
}
export function resolveRGB(
cfg: ColorModeLike,
fixedRGB: readonly [number, number, number],
timeMs: number,
hueOffset=0,
): readonly [number, number, number] {
if(cfg.color_mode !== "rainbow") return fixedRGB;
const hue=rainbowHue(timeMs / 1000, cfg.rainbow_cycle_speed, hueOffset);
return hslToRgb(hue, RAINBOW_SATURATION / 100, RAINBOW_LIGHTNESS / 100);
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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
