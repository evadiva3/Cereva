import type { LayerRenderer } from "../types";
import type { SymptomLayer } from "../../types/layers";
import { VisualSnowRenderer } from "./visualSnow";
import { GeometricAuraRenderer } from "./geometricAura";
import { ScotomaRenderer } from "./scotoma";
import { ColorDistortionRenderer } from "./colorDistortion";
import { PalinopsiaRenderer } from "./palinopsia";
import { PhotophobiaRenderer } from "./photophobia";
import { FortificationSpectraRenderer } from "./fortificationSpectra";
import { AfterimageTrailRenderer } from "./afterimageTrail";
import { TunnelVisionRenderer } from "./tunnelVision";
import { OscillopsiaRenderer } from "./oscillopsia";
import { PhotopsiaFlashesRenderer } from "./photopsiaFlashes";
import { TextBlurRenderer } from "./textBlur";
import { EyeFloatersRenderer } from "./eyeFloaters";
import { EdgeGlowRenderer } from "./edgeGlow";
import { AliceInWonderlandRenderer } from "./aliceInWonderland";
import { MetamorphopsiaRenderer } from "./metamorphopsia";
import { PhospheneBurstRenderer } from "./phospheneBurst";
import { HemianopiaMaskRenderer } from "./hemianopiaMask";
import { LexicalDistortionRenderer } from "./lexicalDistortion";
import { MigratingScotomaRenderer } from "./migratingScotoma";
import { RetinalAfterimageRenderer } from "./retinalAfterimage";
export function createRenderer(layer: SymptomLayer): LayerRenderer {
switch(layer.type){
case "visual_snow":
return new VisualSnowRenderer(layer.config);
case "geometric_aura":
return new GeometricAuraRenderer(layer.config);
case "scotoma":
return new ScotomaRenderer(layer.config);
case "color_distortion":
return new ColorDistortionRenderer(layer.config);
case "palinopsia":
return new PalinopsiaRenderer(layer.config);
case "photophobia":
return new PhotophobiaRenderer(layer.config);
case "fortification_spectra":
return new FortificationSpectraRenderer(layer.config);
case "afterimage_trail":
return new AfterimageTrailRenderer(layer.config);
case "tunnel_vision":
return new TunnelVisionRenderer(layer.config);
case "oscillopsia":
return new OscillopsiaRenderer(layer.config);
case "photopsia_flashes":
return new PhotopsiaFlashesRenderer(layer.config);
case "text_blur":
return new TextBlurRenderer(layer.config);
case "eye_floaters":
return new EyeFloatersRenderer(layer.config);
case "edge_glow":
return new EdgeGlowRenderer(layer.config);
case "alice_in_wonderland":
return new AliceInWonderlandRenderer(layer.config);
case "metamorphopsia":
return new MetamorphopsiaRenderer(layer.config);
case "phosphene_burst":
return new PhospheneBurstRenderer(layer.config);
case "hemianopia_mask":
return new HemianopiaMaskRenderer(layer.config);
case "lexical_distortion":
return new LexicalDistortionRenderer(layer.config);
case "migrating_scotoma":
return new MigratingScotomaRenderer(layer.config);
case "retinal_afterimage":
return new RetinalAfterimageRenderer(layer.config);
}
}
