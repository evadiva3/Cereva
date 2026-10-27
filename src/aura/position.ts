import type { SymptomLayer } from "@aura/schema";
export type Anchor={ x: number; y: number; xKey: string; yKey: string; list?: string; index?: number };
const pairs=[["origin_x", "origin_y"], ["center_x", "center_y"], ["patch_x", "patch_y"]] as const;
export function layerAnchors(layer: SymptomLayer): Anchor[]{
if(!layer.visible) return [];
const config=layer.config as unknown as Record<string, unknown>;
for(const list of ["shapes", "scotomas", "flash_points"]){
const items=config[list];
if(Array.isArray(items)) return items.flatMap((item, index) =>
typeof item.x === "number" && typeof item.y === "number" ? [{ x: item.x, y: item.y, xKey: "x", yKey: "y", list, index }] : []);
}
for(const [xKey,yKey] of pairs){
if(xKey === "patch_x" && config.coverage !== "patch") continue;
if(typeof config[xKey] === "number" && typeof config[yKey] === "number")
return [{ x: config[xKey], y: config[yKey], xKey, yKey }];
}
return [];
}
export function movedConfig(layer: SymptomLayer, anchor: Anchor, dx: number, dy: number): SymptomLayer["config"]{
const clamp=(v: number) => Math.max(0, Math.min(1, v));
const config=layer.config as unknown as Record<string, unknown>;
const change={ [anchor.xKey]: clamp(anchor.x + dx), [anchor.yKey]: clamp(anchor.y + dy) };
if(anchor.list !== undefined && anchor.index !== undefined){
const list=config[anchor.list] as Record<string, unknown>[];
return { ...config, [anchor.list]: list.map((item,i) => i === anchor.index ? { ...item, ...change } : item) } as unknown as SymptomLayer["config"];
}
return { ...config, ...change } as unknown as SymptomLayer["config"];
}
