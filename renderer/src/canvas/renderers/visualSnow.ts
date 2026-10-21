import { mulberry32, supportsCanvasFilter, type FrameContext, type LayerRenderer } from "../types";
import type { ColorTemperature, VisualSnowConfig } from "../../types/layers";
import { resolveRGB } from "../colorModes";
const TEMP_RGB: Record<ColorTemperature, readonly [number, number, number]>={
warm: [255, 232, 200],
cool: [200, 224, 255],
neutral: [235, 235, 235],
};
export class VisualSnowRenderer implements LayerRenderer {
private impl: LayerRenderer;
private cfg: VisualSnowConfig;
constructor(cfg: VisualSnowConfig){
this.cfg=cfg;
this.impl=WebGLSnowRenderer.tryCreate(cfg) ?? new ScatterSnowRenderer(cfg);
}
update(config: unknown): void {
this.cfg=config as VisualSnowConfig;
this.impl.update(config);
}
dispose(): void {
this.impl.dispose?.();
}
render(frame: FrameContext, layerOpacity: number): void {
if(this.impl instanceof WebGLSnowRenderer && this.impl.isDead()){
this.impl.dispose();
this.impl=new ScatterSnowRenderer(this.cfg);
}
this.impl.render(frame, layerOpacity);
}
}

const VERT_SRC=`#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const FRAG_SRC=`#version 300 es
precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_coverage;
uniform float u_colorNoise;
uniform float u_brightness;
uniform float u_grainScale;
uniform float u_epoch;
uniform vec3 u_tint;
out vec4 fragColor;

// simplex noise from Ian McEwan / Ashima Arts, public domain
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float hash11(float n) { return fract(sin(n) * 43758.5453123); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  vec2 px = gl_FragCoord.xy / max(u_grainScale, 0.25);

  float phase = hash12(floor(px / 24.0));
  float e = floor(u_epoch + phase);
  vec2 jump = vec2(hash11(e), hash11(e + 101.7)) * 289.0;

  vec2 uvg = gl_FragCoord.xy / u_resolution.y;
  float gain = valueNoise(uvg * 6.0 + vec2(u_time * 0.02, u_time * 0.007)) * 0.6 + 0.4;

  vec2 p = (px + jump) * mix(0.9, 1.3, u_coverage);
  float n = snoise(p);

  float s = n * 0.5 + 0.5;
  float th = 1.0 - pow(clamp(u_coverage, 0.0, 1.0), 0.6) * 0.85;
  float a = smoothstep(th, th + 0.22, s) * gain * 0.85;

  vec3 rgb;
  if (u_colorNoise > 0.5) {
    float r = clamp(u_brightness + snoise(p + 61.3) * u_intensity, 0.0, 1.0);
    float g = clamp(u_brightness + n * u_intensity, 0.0, 1.0);
    float b = clamp(u_brightness + snoise(p + 59.7) * u_intensity, 0.0, 1.0);
    rgb = vec3(r, g, b);
  } else {
    float v = clamp(u_brightness + n * u_intensity, 0.0, 1.0);
    rgb = v * u_tint;
  }
  fragColor = vec4(rgb, a);
}`;

const UNIFORMS=[
"u_resolution", "u_time", "u_intensity", "u_coverage", "u_colorNoise",
"u_brightness", "u_grainScale", "u_epoch", "u_tint",
] as const;
type UniformName=(typeof UNIFORMS)[number];
class WebGLSnowRenderer implements LayerRenderer {
private cfg: VisualSnowConfig;
private canvas: HTMLCanvasElement;
private gl: WebGL2RenderingContext;
private program: WebGLProgram;
private loc: Record<UniformName, WebGLUniformLocation | null>;
private dead = false;

private epoch = 0;
private lastTimeMs: number | null = null;
static tryCreate(cfg: VisualSnowConfig): WebGLSnowRenderer | null {
try {
const canvas=document.createElement("canvas");
const gl=canvas.getContext("webgl2", {
alpha: true,
premultipliedAlpha: false,
antialias: false,
depth: false,
stencil: false,
});
if(!gl) return null;
const compile=(type: number, src: string): WebGLShader | null => {
const shader=gl.createShader(type);
if(!shader) return null;
gl.shaderSource(shader, src);
gl.compileShader(shader);
if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
console.error("[visual snow] shader compile failed:", gl.getShaderInfoLog(shader));
gl.deleteShader(shader);
return null;
}
return shader;
};
const vs=compile(gl.VERTEX_SHADER, VERT_SRC);
const fs=compile(gl.FRAGMENT_SHADER, FRAG_SRC);
if(!vs || !fs) return null;
const program=gl.createProgram();
if(!program) return null;
gl.attachShader(program, vs);
gl.attachShader(program, fs);
gl.linkProgram(program);
gl.deleteShader(vs);
gl.deleteShader(fs);
if(!gl.getProgramParameter(program, gl.LINK_STATUS)){
console.error("[visual snow] program link failed:", gl.getProgramInfoLog(program));
return null;
}
return new WebGLSnowRenderer(cfg, canvas, gl, program);
}catch {
return null;
}
}
private constructor(
cfg: VisualSnowConfig,
canvas: HTMLCanvasElement,
gl: WebGL2RenderingContext,
program: WebGLProgram,
){
this.cfg=cfg;
this.canvas=canvas;
this.gl=gl;
this.program=program;
this.loc=Object.fromEntries(
UNIFORMS.map((name) => [name, gl.getUniformLocation(program, name)]),
) as Record<UniformName, WebGLUniformLocation | null>;
canvas.addEventListener("webglcontextlost", (e) => {
e.preventDefault();
this.dead=true;
});
}
isDead(): boolean {
return this.dead;
}
update(config: unknown): void {
this.cfg=config as VisualSnowConfig;
}
dispose(): void {
if(!this.gl.isContextLost()) this.gl.deleteProgram(this.program);
this.canvas.width=1;
this.canvas.height=1;
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, dpr, timeMs, dtMs }=frame;
const cfg=this.cfg;
if(layerOpacity <= 0.003) return;
if(this.gl.isContextLost()){
this.dead=true;
return;
}
const bw=Math.max(1, Math.round(width * dpr));
const bh=Math.max(1, Math.round(height * dpr));
if(this.canvas.width !== bw || this.canvas.height !== bh){
this.canvas.width=bw;
this.canvas.height=bh;
}

const churnEff=Math.max(0, Math.min(1, cfg.churn * Math.min(1, cfg.flicker_speed)));
const dt=this.lastTimeMs === null ? dtMs : timeMs - this.lastTimeMs;
this.lastTimeMs=timeMs;
this.epoch += (Math.min(dt, 100) / 1000) * 60 * churnEff;
const [tr, tg, tb]=resolveRGB(cfg, TEMP_RGB[cfg.color_temperature], timeMs);
const gl=this.gl;
gl.viewport(0, 0, bw, bh);
gl.disable(gl.BLEND);
gl.clearColor(0, 0, 0, 0);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.useProgram(this.program);
gl.uniform2f(this.loc.u_resolution, bw, bh);
gl.uniform1f(this.loc.u_time, timeMs / 1000);
gl.uniform1f(this.loc.u_intensity, cfg.intensity);
gl.uniform1f(this.loc.u_coverage, cfg.density / 20000);
gl.uniform1f(this.loc.u_colorNoise, cfg.color_noise ? 1 : 0);
gl.uniform1f(this.loc.u_brightness, cfg.brightness);
gl.uniform1f(this.loc.u_grainScale, Math.max(0.5, cfg.particle_size) * dpr);
gl.uniform1f(this.loc.u_epoch, this.epoch);
gl.uniform3f(this.loc.u_tint, tr / 255, tg / 255, tb / 255);
gl.drawArrays(gl.TRIANGLES, 0, 3);
ctx.save();
ctx.globalAlpha=layerOpacity;
const breathe=(Math.random() - 0.5) * 0.024;
if(supportsCanvasFilter()){
ctx.filter=`brightness(${(1 + breathe).toFixed(4)})`;
}else{
ctx.globalAlpha=layerOpacity * (1 + breathe);
}
ctx.drawImage(this.canvas, 0, 0, bw, bh, 0, 0, width, height);
ctx.restore();
}
}
const GAIN_GRID=32;
const GAIN_SCROLL_X=2.0;
const GAIN_SCROLL_Y=0.7;
const MAX_LIFETIME_FRAMES=24;
class ScatterSnowRenderer implements LayerRenderer {
private cfg: VisualSnowConfig;
private buffer: HTMLCanvasElement | null = null;
private img: ImageData | null = null;
private bw = 0;
private bh = 0;
private bufferScale = 1;
private gainGrid: Float32Array | null = null;
private slots: Int32Array[] = [];
private slotCounts: number[] = [];
private slotCursor = 0;
private ringKey = "";

constructor(cfg: VisualSnowConfig){
this.cfg=cfg;
}

update(config: unknown): void {
this.cfg=config as VisualSnowConfig;
}
dispose(): void {
this.buffer=null;
this.img=null;
this.gainGrid=null;
this.slots=[];
}
render(frame: FrameContext, layerOpacity: number): void {
const { ctx, width, height, timeMs }=frame;
const cfg=this.cfg;
if(layerOpacity <= 0.003) return;
this.ensureBuffer(width, height);
if(!this.gainGrid) this.buildGainGrid();
const churnEff=Math.max(0, Math.min(1, cfg.churn * Math.min(1, cfg.flicker_speed)));
const frozen=churnEff < 0.02;
const lifetime=frozen
? MAX_LIFETIME_FRAMES
: Math.max(1, Math.min(MAX_LIFETIME_FRAMES, Math.round(1 / churnEff)));

const ringKey=`${this.bw}x${this.bh}|${lifetime}`;
const needsInitialFill=ringKey !== this.ringKey;
if(needsInitialFill){
this.ringKey=ringKey;
this.slots=new Array(lifetime);
this.slotCounts=new Array(lifetime).fill(0);
this.slotCursor=0;
this.img!.data.fill(0);
}
const coverage=cfg.density / 20000;
const totalGrains=Math.round((coverage * this.bw * this.bh) / 4);
const perFrame=Math.max(1, Math.round(totalGrains / lifetime));
if(needsInitialFill){
for(let s = 0; s < lifetime; s++){
this.spawnSlot(s, perFrame, timeMs, width, height);
}
}else if(!frozen){
const slot=this.slotCursor;
this.slotCursor=(this.slotCursor + 1) % lifetime;
this.eraseSlot(slot);
this.spawnSlot(slot, perFrame, timeMs, width, height);
}

const bctx=this.buffer!.getContext("2d")!;
bctx.putImageData(this.img!, 0, 0);
ctx.save();
ctx.globalAlpha=layerOpacity;
ctx.imageSmoothingEnabled=false;
const breathe=(Math.random() - 0.5) * 0.024;
if(supportsCanvasFilter()){
ctx.filter=`brightness(${(1 + breathe).toFixed(4)})`;
}else{
ctx.globalAlpha=layerOpacity * (1 + breathe);
}
ctx.drawImage(this.buffer!, 0, 0, this.bw, this.bh, 0, 0, width, height);
ctx.restore();
}
private eraseSlot(slot: number): void {
const entries=this.slots[slot];
const count=this.slotCounts[slot];
if(!entries || count === 0) return;
const data=this.img!.data;
const bw=this.bw;
for(let i = 0; i < count; i++){
const packed=entries[i];
const size=(packed & 3) + 1;
const idx=packed >>> 2;
const x=idx % bw;
const y=(idx / bw) | 0;
for(let dy = 0; dy < size; dy++){
const row=((y + dy) * bw + x) * 4;
for(let dx = 0; dx < size; dx++){
data[row + dx * 4 + 3] = 0;
}
}
}
this.slotCounts[slot]=0;
}
private spawnSlot(
slot: number,
count: number,
timeMs: number,
width: number,
height: number,
): void {
let entries=this.slots[slot];
if(!entries || entries.length < count){
entries=new Int32Array(count);
this.slots[slot]=entries;
}
const cfg=this.cfg;
const data=this.img!.data;
const bw=this.bw;
const bh=this.bh;
const grid=this.gainGrid!;
const scale=this.bufferScale;
const mid=cfg.brightness * 255;
const range=cfg.intensity * 255;
const [tr, tg, tb]=resolveRGB(cfg, TEMP_RGB[cfg.color_temperature], timeMs);
const colored=cfg.color_noise;
const tSec=timeMs / 1000;
const sx=((tSec * GAIN_SCROLL_X) / width) * GAIN_GRID;
const sy=((tSec * GAIN_SCROLL_Y) / height) * GAIN_GRID;
for(let n = 0; n < count; n++){
const roll=Math.random();
const size=roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3;
const x=(Math.random() * (bw - size)) | 0;
const y=(Math.random() * (bh - size)) | 0;
entries[n]=(((y * bw + x) << 2) | (size - 1)) | 0;
const gain=this.sampleGain(
((x * scale) / width) * GAIN_GRID + sx,
((y * scale) / height) * GAIN_GRID + sy,
grid,
);
let r: number, g: number, b: number;
if(colored){
r=clampByte(mid + (Math.random() - 0.5) * 2 * range);
g=clampByte(mid + (Math.random() - 0.5) * 2 * range);
b=clampByte(mid + (Math.random() - 0.5) * 2 * range);
}else{
const v=mid + (Math.random() - 0.5) * 2 * range;
r=clampByte((v * tr) / 255);
g=clampByte((v * tg) / 255);
b=clampByte((v * tb) / 255);
}
const a=clampByte(255 * gain * (0.55 + Math.random() * 0.45));
for(let dy = 0; dy < size; dy++){
const row=((y + dy) * bw + x) * 4;
for(let dx = 0; dx < size; dx++){
const i=row + dx * 4;
data[i]=r;
data[i + 1] = g;
data[i + 2] = b;
data[i + 3] = a;
}
}
}
this.slotCounts[slot]=count;
}
private sampleGain(u: number, v: number, grid: Float32Array): number {
const wrap=(n: number) => ((n % GAIN_GRID) + GAIN_GRID) % GAIN_GRID;
const uw=wrap(u);
const vw=wrap(v);
const x0=uw | 0;
const y0=vw | 0;
const fx=uw - x0;
const fy=vw - y0;
const x1=(x0 + 1) % GAIN_GRID;
const y1=(y0 + 1) % GAIN_GRID;
const g00=grid[y0 * GAIN_GRID + x0];
const g10=grid[y0 * GAIN_GRID + x1];
const g01=grid[y1 * GAIN_GRID + x0];
const g11=grid[y1 * GAIN_GRID + x1];
return (
g00 * (1 - fx) * (1 - fy) +
g10 * fx * (1 - fy) +
g01 * (1 - fx) * fy +
g11 * fx * fy
);
}
private buildGainGrid(): void {
const rand=mulberry32(0x5e0f);
const raw=new Float32Array(GAIN_GRID * GAIN_GRID);
for(let i = 0; i < raw.length; i++) raw[i] = rand();
const grid=new Float32Array(GAIN_GRID * GAIN_GRID);
for(let y = 0; y < GAIN_GRID; y++){
for(let x = 0; x < GAIN_GRID; x++){
let sum=0;
for(let dy = -1; dy <= 1; dy++){
for(let dx = -1; dx <= 1; dx++){
const xx=(x + dx + GAIN_GRID) % GAIN_GRID;
const yy=(y + dy + GAIN_GRID) % GAIN_GRID;
sum += raw[yy * GAIN_GRID + xx];
}
}
grid[y * GAIN_GRID + x] = 0.4 + 0.6 * (sum / 9);
}
}
this.gainGrid=grid;
}
private ensureBuffer(width: number, height: number): void {
const scale=Math.max(1, Math.min(4, Math.round(this.cfg.particle_size)));
const bw=Math.max(4, Math.ceil(width / scale));
const bh=Math.max(4, Math.ceil(height / scale));
if(this.buffer && bw === this.bw && bh === this.bh && scale === this.bufferScale) return;

this.bufferScale=scale;
this.bw=bw;
this.bh=bh;
if(!this.buffer) this.buffer = document.createElement("canvas");
this.buffer.width=bw;
this.buffer.height=bh;
this.img=this.buffer.getContext("2d")!.createImageData(bw, bh);
this.ringKey="";
}
}
function clampByte(v: number): number {
return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
