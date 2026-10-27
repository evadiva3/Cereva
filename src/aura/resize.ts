import { LAYER_FIELD_SPECS, type SymptomLayer } from "@aura/schema";
import type { Anchor } from "./position";
const DIMENSIONS=new Set(["radius_scale","size","size_px","dot_size_px","blob_size_px","radius_percent","patch_radius_percent","orbit_radius_percent","glare_radius"]);
export function resizeFields(layer:SymptomLayer,anchor?:Anchor):string[]{
const config=layer.config as unknown as Record<string,unknown>;
const specs=LAYER_FIELD_SPECS[layer.type];
if(anchor?.list){
const spec=specs[anchor.list];
return spec?.kind === "list" ? Object.keys(spec.of).filter(key => DIMENSIONS.has(key)) : [];
}
return Object.keys(specs).filter(key => DIMENSIONS.has(key) && typeof config[key] === "number" && !(key === "patch_radius_percent" && config.coverage === "global"));
}
export function canResize(layer:SymptomLayer):boolean{
if(!layer.visible) return false;
if(resizeFields(layer).length) return true;
return ["shapes","scotomas"].some(list => {
const values=(layer.config as unknown as Record<string,unknown>)[list];
return Array.isArray(values) && values.length>0 && values.some(item => typeof item.size === "number");
});
}
export function resizedConfig(layer:SymptomLayer,anchor:Anchor | undefined,scale:number):SymptomLayer["config"]{
if(!Number.isFinite(scale) || scale<=0) return layer.config;
const config=layer.config as unknown as Record<string,unknown>;
const specs=LAYER_FIELD_SPECS[layer.type];
const listSpec=anchor?.list ? specs[anchor.list] : undefined;
const item=anchor?.list && anchor.index !== undefined ? (config[anchor.list] as Record<string,unknown>[])[anchor.index] : config;
if(!item) return layer.config;
const next={...item};
for(const key of resizeFields(layer,anchor)){
const spec=listSpec?.kind === "list" ? listSpec.of[key] : specs[key];
const value=item[key];
if(spec?.kind !== "number" || typeof value !== "number") continue;
const scaled=Math.max(spec.min,Math.min(spec.max,value*scale));
next[key]=spec.int ? Math.round(scaled) : scaled;
}
return (anchor?.list && anchor.index !== undefined ? {...config,[anchor.list]:(config[anchor.list] as Record<string,unknown>[]).map((value,index) => index === anchor.index ? next : value)} : next) as unknown as SymptomLayer["config"];
}
