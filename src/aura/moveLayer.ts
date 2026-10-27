
const ARRAYS=["scotomas", "shapes", "flash_points", "dots", "points"] as const;

const PAIRS: [string, string][]=[
["x", "y"],
["center_x", "center_y"],
];

function clamp01(v: number){
return Math.min(1, Math.max(0, v));
}

function shiftPair(target: Record<string, unknown>, dx: number, dy: number){
let moved=false;
for(const [xk, yk] of PAIRS){
const x=target[xk];
const y=target[yk];
if(typeof x === "number" && typeof y === "number"){
target[xk]=clamp01(x + dx);
target[yk]=clamp01(y + dy);
moved=true;
}
}
return moved;
}

export function canMove(config: unknown): boolean {
if(!config || typeof config !== "object") return false;
const c=config as Record<string, unknown>;
for(const [xk, yk] of PAIRS){
if(typeof c[xk] === "number" && typeof c[yk] === "number") return true;
}
for(const key of ARRAYS){
const list=c[key];
if(Array.isArray(list) && list.some((i) => i && typeof i === "object" && "x" in i && "y" in i)){
return true;
}
}
return false;
}

export function moveConfig<T>(config: T, dx: number, dy: number): T {
if(!config || typeof config !== "object") return config;
const next=JSON.parse(JSON.stringify(config)) as Record<string, unknown>;

shiftPair(next, dx, dy);

for(const key of ARRAYS){
const list=next[key];
if(!Array.isArray(list)) continue;
for(const item of list){
if(item && typeof item === "object") shiftPair(item as Record<string, unknown>, dx, dy);
}
}

return next as T;
}
