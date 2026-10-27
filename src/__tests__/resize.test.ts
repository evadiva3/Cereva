import { defaultLayer, normalizeAuraState, type SymptomLayer } from "@aura/schema";
import { layerAnchors } from "../aura/position";
import { canResize, resizedConfig } from "../aura/resize";
it("pinches the selected shape without changing its neighbor or position",()=>{
const layer=defaultLayer("scotoma",true);
if(layer.type !== "scotoma") throw new Error("wrong layer");
layer.config.scotomas=[{...layer.config.scotomas[0]!,size:.1},{...layer.config.scotomas[0]!,size:.2}];
const next={...layer,config:resizedConfig(layer,layerAnchors(layer)[1],2)} as SymptomLayer;
if(next.type !== "scotoma") throw new Error("wrong layer");
expect(next.config.scotomas.map(shape=>shape.size)).toEqual([.1,.4]);
expect(next.config.scotomas[1]!.x).toBe(layer.config.scotomas[1]!.x);
expect(layer.config.scotomas[1]!.size).toBe(.2);
});
it("clamps pinches to schema limits and survives normalization",()=>{
const layer=defaultLayer("geometric_aura",true);
const config=resizedConfig(layer,layerAnchors(layer)[0],1000);
const saved=normalizeAuraState({layers:[{...layer,config}]}).state.layers[0]!;
if(saved.type !== "geometric_aura") throw new Error("wrong layer");
expect(saved.config.shapes[0]!.size).toBe(1);
});
it("resizes the animated crescent independently of its movement speed",()=>{
const layer=defaultLayer("fortification_spectra",true);
const next={...layer,config:resizedConfig(layer,layerAnchors(layer)[0],2)} as SymptomLayer;
if(next.type !== "fortification_spectra" || layer.type !== "fortification_spectra") throw new Error("wrong layer");
expect(next.config.radius_scale).toBe(2);
expect(next.config.expansion_rate).toBe(layer.config.expansion_rate);
});
it("does not suggest pinching a full-scene effect with no spatial size",()=>{
expect(canResize(defaultLayer("color_distortion",true))).toBe(false);
expect(canResize(defaultLayer("geometric_aura",false))).toBe(false);
const layer=defaultLayer("phosphene_burst",true);
expect(resizedConfig(layer,undefined,Number.NaN)).toBe(layer.config);
});
