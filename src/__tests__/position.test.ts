import { defaultLayer, normalizeAuraState, type SymptomLayer } from "@aura/schema";
import { layerAnchors, movedConfig } from "../aura/position";

test("dragging a geometric aura preserves its other settings and survives save normalization", () => {
const layer=defaultLayer("geometric_aura",true);
const before=JSON.stringify(layer);
const anchor=layerAnchors(layer)[0]!;
const config=movedConfig(layer,anchor,.2,-.1);
const saved=normalizeAuraState({schemaVersion:1,layers:[{...layer,config}]}).state.layers[0]!;
const after=layerAnchors(saved)[0]!;
expect(after.x).toBeCloseTo(anchor.x+.2);
expect(after.y).toBeCloseTo(anchor.y-.1);
expect(JSON.stringify(layer)).toBe(before);
});
test("moving one scotoma does not move its neighbor and clamps to the preview", () => {
const layer=defaultLayer("scotoma",true);
if(layer.type!=="scotoma") throw new Error("wrong layer");
layer.config.scotomas=[{...layer.config.scotomas[0]!,x:.2,y:.3},{...layer.config.scotomas[0]!,x:.8,y:.7}];
const config=movedConfig(layer,layerAnchors(layer)[1]!,10,-10);
const moved={...layer,config} as SymptomLayer;
expect(layerAnchors(moved).map(p=>[p.x,p.y])).toEqual([[.2,.3],[1,0]]);
});
test("full scene and hidden effects do not present misleading drag handles", () => {
expect(layerAnchors(defaultLayer("visual_snow",true))).toEqual([]);
expect(layerAnchors(defaultLayer("fortification_spectra",false))).toEqual([]);
const blur=defaultLayer("text_blur",true);
if(blur.type!=="text_blur") throw new Error("wrong layer");
blur.config.coverage="global";
expect(layerAnchors(blur)).toEqual([]);
blur.config.coverage="patch";
expect(layerAnchors(blur)).toHaveLength(1);
});
