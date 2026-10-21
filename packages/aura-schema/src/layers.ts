
export type ColorTemperature = "warm" | "cool" | "neutral";

export type ColorMode = "fixed" | "rainbow";

export type ExtendedColorMode = ColorMode | "spectrum";

export interface ColorModeFields {
color_mode: ColorMode;
rainbow_cycle_speed: number;
}

export interface SpectrumColorModeFields {
color_mode: ExtendedColorMode;
rainbow_cycle_speed: number;
}

export interface VisualSnowConfig extends ColorModeFields {
density: number;
brightness: number;
color_temperature: ColorTemperature;
flicker_speed: number;
particle_size: number;
intensity: number;
color_noise: boolean;
churn: number;
}

export type AuraShapeType =
| "zigzag"
| "fortification"
| "spiral"
| "arc"
| "expanding_ring";

export interface AuraShape {
shape_type: AuraShapeType;
x: number;
y: number;
size: number;
animation_speed: number;
color: string;
opacity: number;
}

export interface GeometricAuraConfig extends SpectrumColorModeFields {
shapes: AuraShape[];
internal_shimmer: boolean;
asymmetry: number;
asymmetry_angle: number;
inner_color: string;
outer_color: string;
shimmer: boolean;
brightness: number;
}

export interface ScotomaBlob {
x: number;
y: number;
size: number;
shape: "circular" | "irregular";
opacity: number;
edge_softness: number;
seed: number;
}

export interface ScotomaConfig extends SpectrumColorModeFields {
scotomas: ScotomaBlob[];
fill_color: string;
border_color: string;
edge_softness_px: number;
seamless: boolean;
}

export type DistortionPattern = "uniform" | "pulsing" | "quadrant";
export type Quadrant = "top_left" | "top_right" | "bottom_left" | "bottom_right";

export interface ColorDistortionConfig {
hue_shift: number;
saturation_boost: number;
contrast: number;
pattern: DistortionPattern;
pulse_speed: number;
quadrant: Quadrant;
}

export interface PalinopsiaConfig {
trail_length: number;
decay_speed: number;
opacity: number;
}

export interface PhotophobiaConfig {
luminance_reduction: number;
glare_intensity: number;
glare_radius: number;
}

export interface FortificationSpectraConfig extends ColorModeFields {
origin_x: number;
origin_y: number;
expansion_rate: number;
arc_angle_degrees: number;
zigzag_amplitude: number;
zigzag_frequency: number;
color: string;
cycle_duration_seconds: number;
}

export interface AfterimageTrailConfig {
trail_length_frames: number;
decay_curve: "linear" | "exponential";
opacity_start: number;
triggers_on: "motion" | "always";
}

export interface TunnelVisionConfig extends SpectrumColorModeFields {
radius_percent: number;
edge_softness_px: number;
fill_style: "black" | "blur";
}

export interface OscillopsiaConfig {
amplitude_px: number;
frequency_hz: number;
motion_type: "horizontal" | "vertical" | "rotational" | "combined";
}

export interface FlashPoint {
x: number;
y: number;
}

export interface PhotopsiaFlashesConfig extends ColorModeFields {
flash_points: FlashPoint[];
flash_duration_ms: number;
flashes_per_minute: number;
flash_color: string;
}

export interface TextBlurConfig {
blur_type: "gaussian" | "motion" | "radial";
blur_radius_px: number;
coverage: "global" | "patch";
patch_x: number;
patch_y: number;
patch_radius_percent: number;
pulse: boolean;
pulse_frequency_hz: number;
}

export interface EyeFloatersConfig {
variant: "opaque" | "translucent";
count: number;
drift_speed: number;
drift_pattern: "gravity" | "random_walk" | "eye_movement_responsive";
size_variance: number;
color: string;
custom_shapes: Array<Array<[number, number]>>;
use_custom_shapes: boolean;
}

export interface EdgeGlowConfig extends SpectrumColorModeFields {
detection_threshold: number;
glow_color: string;
glow_width_px: number;
glow_opacity: number;
chromatic_aberration: boolean;
aberration_offset_px: number;
pulse: boolean;
pulse_frequency_hz: number;
}

export interface AliceInWonderlandConfig extends SpectrumColorModeFields {
center_x: number;
center_y: number;
radius_percent: number;
distortion_type: "micropsia" | "macropsia";
intensity: number;
}

export interface MetamorphopsiaConfig extends SpectrumColorModeFields {
wave_amplitude_px: number;
wave_frequency: number;
coverage: "global" | "patch";
patch_x: number;
patch_y: number;
patch_radius_percent: number;
}

export interface PhospheneBurstConfig {
burst_rate_per_minute: number;
shape_type: "star" | "ring" | "ray_burst" | "random";
color: string;
size_px: number;
}

export interface LexicalDistortionConfig {
words_per_second: number;
color_palette: "random" | "warm" | "cool" | "spectrum";
highlight_mode: "color" | "highlight" | "both";
text_mode: "color_only" | "highlight" | "both";
duration_ms: number;
intensity: number;
simultaneous_words: number;
}

export interface MigratingScotomaConfig {
dot_count: number;
dot_size_px: number;
fill_color: string;
opacity: number;
edge_softness_px: number;
path_type: "drift" | "orbit" | "erratic" | "crawl" | "swarm";
speed: number;
drift_angle: number;
orbit_radius_percent: number;
}

export interface RetinalAfterimageConfig {
trigger_mode: "ambient" | "gaze" | "both";
spawn_rate_per_minute: number;
gaze_dwell_ms: number;
gaze_trigger_radius_px: number;
blob_count_max: number;
blob_size_px: number;
hold_duration_ms: number;
fade_duration_ms: number;
blob_softness: number;
}

export interface HemianopiaMaskConfig extends SpectrumColorModeFields {
side: "left" | "right";
edge_softness_px: number;
fill_opacity: number;
edge_color: string;
}

export interface LayerConfigMap {
visual_snow: VisualSnowConfig;
geometric_aura: GeometricAuraConfig;
scotoma: ScotomaConfig;
color_distortion: ColorDistortionConfig;
palinopsia: PalinopsiaConfig;
photophobia: PhotophobiaConfig;
fortification_spectra: FortificationSpectraConfig;
afterimage_trail: AfterimageTrailConfig;
tunnel_vision: TunnelVisionConfig;
oscillopsia: OscillopsiaConfig;
photopsia_flashes: PhotopsiaFlashesConfig;
text_blur: TextBlurConfig;
eye_floaters: EyeFloatersConfig;
edge_glow: EdgeGlowConfig;
alice_in_wonderland: AliceInWonderlandConfig;
metamorphopsia: MetamorphopsiaConfig;
phosphene_burst: PhospheneBurstConfig;
hemianopia_mask: HemianopiaMaskConfig;
lexical_distortion: LexicalDistortionConfig;
migrating_scotoma: MigratingScotomaConfig;
retinal_afterimage: RetinalAfterimageConfig;
}

export type LayerType = keyof LayerConfigMap;

export type SymptomLayer = {
[K in LayerType]: {
id: K;
type: K;
visible: boolean;
opacity: number;
config: LayerConfigMap[K];
};
}[LayerType];

export const LAYER_ORDER: LayerType[]=[
"visual_snow",
"eye_floaters",
"geometric_aura",
"fortification_spectra",
"photopsia_flashes",
"phosphene_burst",
"scotoma",
"migrating_scotoma",
"color_distortion",
"text_blur",
"lexical_distortion",
"alice_in_wonderland",
"metamorphopsia",
"edge_glow",
"photophobia",
"hemianopia_mask",
"tunnel_vision",
"retinal_afterimage",
"palinopsia",
"afterimage_trail",
"oscillopsia",
];

export const LAYER_CATEGORIES: { label: string; types: LayerType[] }[]=[
{ label: "Snow & Static", types: ["visual_snow", "eye_floaters"] },
{
label: "Aura & Geometry",
types: ["geometric_aura", "fortification_spectra", "photopsia_flashes", "phosphene_burst"],
},
{
label: "Field Effects",
types: [
"scotoma",
"migrating_scotoma",
"color_distortion",
"text_blur",
"lexical_distortion",
"alice_in_wonderland",
"metamorphopsia",
"edge_glow",
"photophobia",
"hemianopia_mask",
"tunnel_vision",
],
},
{
label: "Motion & Temporal",
types: ["retinal_afterimage", "palinopsia", "afterimage_trail", "oscillopsia"],
},
];

export const LAYER_LABELS: Record<LayerType, string>={
visual_snow: "Visual Snow",
geometric_aura: "Geometric Auras",
scotoma: "Scotomas",
color_distortion: "Color Distortion",
palinopsia: "Afterimages / Palinopsia",
photophobia: "Photophobia",
fortification_spectra: "Fortification Spectra",
afterimage_trail: "Afterimage Trails",
tunnel_vision: "Tunnel Vision",
oscillopsia: "Oscillopsia",
photopsia_flashes: "Photopsia Flashes",
text_blur: "Text Blur",
eye_floaters: "Eye Floaters",
edge_glow: "Edge Glow",
alice_in_wonderland: "Alice in Wonderland",
metamorphopsia: "Metamorphopsia",
phosphene_burst: "Phosphene Bursts",
hemianopia_mask: "Hemianopia",
lexical_distortion: "Lexical Distortion",
migrating_scotoma: "Migrating Scotomas",
retinal_afterimage: "Retinal Afterimages",
};

export const DEFAULT_CONFIGS: { [K in LayerType]: LayerConfigMap[K] }={
visual_snow: {
density: 3000,
brightness: 0.5,
color_temperature: "neutral",
flicker_speed: 1.0,
particle_size: 1.0,
intensity: 0.8,
color_noise: false,
churn: 1.0,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
geometric_aura: {
shapes: [
{
shape_type: "fortification",
x: 0.35,
y: 0.45,
size: 0.2,
animation_speed: 1.0,
color: "#ffd700",
opacity: 0.8,
},
],
internal_shimmer: false,
asymmetry: 0.0,
asymmetry_angle: 0.0,
inner_color: "#ffffff",
outer_color: "#a0c0ff",
shimmer: true,
brightness: 0.65,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
scotoma: {
scotomas: [
{
x: 0.6,
y: 0.4,
size: 0.1,
shape: "circular",
opacity: 0.7,
edge_softness: 0.5,
seed: 1,
},
],
fill_color: "#12080e",
border_color: "#2a1535",
edge_softness_px: 45.0,
seamless: false,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
color_distortion: {
hue_shift: 0,
saturation_boost: 1.0,
contrast: 1.0,
pattern: "uniform",
pulse_speed: 1.0,
quadrant: "top_left",
},
palinopsia: {
trail_length: 0.5,
decay_speed: 1.0,
opacity: 0.5,
},
photophobia: {
luminance_reduction: 0.3,
glare_intensity: 0.5,
glare_radius: 0.1,
},
fortification_spectra: {
origin_x: 0.5,
origin_y: 0.5,
expansion_rate: 2.0,
arc_angle_degrees: 120,
zigzag_amplitude: 14,
zigzag_frequency: 6,
color: "#ffd700",
cycle_duration_seconds: 1200,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
afterimage_trail: {
trail_length_frames: 8,
decay_curve: "exponential",
opacity_start: 0.6,
triggers_on: "motion",
},
tunnel_vision: {
radius_percent: 60,
edge_softness_px: 80,
fill_style: "black",
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
oscillopsia: {
amplitude_px: 6,
frequency_hz: 2,
motion_type: "horizontal",
},
photopsia_flashes: {
flash_points: [
{ x: 0.25, y: 0.3 },
{ x: 0.75, y: 0.65 },
],
flash_duration_ms: 120,
flashes_per_minute: 20,
flash_color: "#ffffff",
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
eye_floaters: {
variant: "opaque",
count: 6,
drift_speed: 0.3,
drift_pattern: "gravity",
size_variance: 0.5,
color: "#2a2a2a",
custom_shapes: [],
use_custom_shapes: false,
},
alice_in_wonderland: {
center_x: 0.5,
center_y: 0.5,
radius_percent: 22.0,
distortion_type: "macropsia",
intensity: 0.5,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
metamorphopsia: {
wave_amplitude_px: 6.0,
wave_frequency: 3.0,
coverage: "patch",
patch_x: 0.5,
patch_y: 0.5,
patch_radius_percent: 25.0,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
phosphene_burst: {
burst_rate_per_minute: 10,
shape_type: "random",
color: "#ffffff",
size_px: 60,
},
hemianopia_mask: {
side: "left",
edge_softness_px: 20,
fill_opacity: 0.6,
edge_color: "#c9c2ec",
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
edge_glow: {
detection_threshold: 30,
glow_color: "#ffffff",
glow_width_px: 8.0,
glow_opacity: 0.6,
chromatic_aberration: true,
aberration_offset_px: 3.0,
pulse: false,
pulse_frequency_hz: 0.5,
color_mode: "fixed",
rainbow_cycle_speed: 1.0,
},
text_blur: {
blur_type: "gaussian",
blur_radius_px: 4.0,
coverage: "global",
patch_x: 0.5,
patch_y: 0.5,
patch_radius_percent: 20.0,
pulse: false,
pulse_frequency_hz: 0.5,
},
lexical_distortion: {
words_per_second: 1.5,
color_palette: "random",
highlight_mode: "color",
text_mode: "color_only",
duration_ms: 800,
intensity: 0.7,
simultaneous_words: 3,
},
migrating_scotoma: {
dot_count: 3,
dot_size_px: 18.0,
fill_color: "#0a0510",
opacity: 0.85,
edge_softness_px: 8.0,
path_type: "drift",
speed: 0.5,
drift_angle: 45.0,
orbit_radius_percent: 30.0,
},
retinal_afterimage: {
trigger_mode: "ambient",
spawn_rate_per_minute: 8.0,
gaze_dwell_ms: 1500,
gaze_trigger_radius_px: 40.0,
blob_count_max: 4,
blob_size_px: 60.0,
hold_duration_ms: 2000,
fade_duration_ms: 3000,
blob_softness: 30.0,
},
};

export function defaultLayer<K extends LayerType>(
type: K,
visible=false,
): SymptomLayer {
return {
id: type,
type,
visible,
opacity: 1.0,
config: structuredClone(DEFAULT_CONFIGS[type]),
} as SymptomLayer;
}
