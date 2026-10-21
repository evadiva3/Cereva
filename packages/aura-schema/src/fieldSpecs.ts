
import type { LayerType } from "./layers";

export interface NumberSpec {
kind: "number";
min: number;
max: number;
default: number;
int?: boolean | undefined;
unit?: string | undefined;
label: string;
hint?: string | undefined;
}

export interface BoolSpec {
kind: "bool";
default: boolean;
label: string;
hint?: string | undefined;
}

export interface EnumSpec {
kind: "enum";
values: readonly string[];
default: string;
label: string;
hint?: string | undefined;
}

export interface ColorSpec {
kind: "color";
default: string;
label: string;
hint?: string | undefined;
}

export interface ListSpec {
kind: "list";
of: Record<string, LeafSpec>;
minItems: number;
maxItems: number;
default: ReadonlyArray<Record<string, unknown>>;
label: string;
hint?: string | undefined;
}

export interface PolylineListSpec {
kind: "polylines";
minPoints: number;
maxPoints: number;
maxShapes: number;
label: string;
hint?: string | undefined;
}

export type LeafSpec = NumberSpec | BoolSpec | EnumSpec | ColorSpec;
export type FieldSpec = LeafSpec | ListSpec | PolylineListSpec;

const n=(
min: number,
max: number,
def: number,
label: string,
extra: Partial<NumberSpec> = {},
): NumberSpec => ({ kind: "number", min, max, default: def, label, ...extra });

const b=(def: boolean, label: string, hint?: string): BoolSpec => ({
kind: "bool",
default: def,
label,
hint,
});

const e=<T extends readonly string[]>(
values: T,
def: T[number],
label: string,
hint?: string,
): EnumSpec => ({ kind: "enum", values, default: def, label, hint });

const c=(def: string, label: string, hint?: string): ColorSpec => ({
kind: "color",
default: def,
label,
hint,
});

const COLOR_MODE_FIELDS: Record<string, LeafSpec>={
color_mode: e(["fixed", "rainbow"] as const, "fixed", "Color mode",
"rainbow cycles one hue continuously over time"),
rainbow_cycle_speed: n(0, 30, 1.0, "Rainbow speed", { unit: "cycles per minute" }),
};

const SPECTRUM_COLOR_MODE_FIELDS: Record<string, LeafSpec>={
color_mode: e(["fixed", "rainbow", "spectrum"] as const, "fixed", "Color mode",
"spectrum is a static prismatic band along the edge, all colors at once, no animation"),
rainbow_cycle_speed: n(0, 30, 1.0, "Rainbow speed", { unit: "cycles per minute" }),
};

export const LAYER_FIELD_SPECS: Record<LayerType, Record<string, FieldSpec>>={
visual_snow: {
density: n(100, 20000, 3000, "Density", { int: true, hint: "spatial coverage" }),
brightness: n(0, 1, 0.5, "Brightness"),
color_temperature: e(["warm", "cool", "neutral"] as const, "neutral", "Color temperature"),
flicker_speed: n(0, 5, 1.0, "Flicker speed", { hint: "0 freezes the field" }),
particle_size: n(0.5, 4, 1.0, "Grain size", { unit: "px" }),
intensity: n(0, 1, 0.8, "Intensity", { hint: "contrast around brightness" }),
color_noise: b(false, "Colored static", "independent red, green and blue flicker"),
churn: n(0, 1, 1.0, "Churn", { hint: "how much of the field re-randomizes per frame" }),
...COLOR_MODE_FIELDS,
},

eye_floaters: {
variant: e(["opaque", "translucent"] as const, "opaque", "Variant"),
count: n(1, 20, 6, "Count", { int: true }),
drift_speed: n(0.1, 2.0, 0.3, "Drift speed"),
drift_pattern: e(
["gravity", "random_walk", "eye_movement_responsive"] as const,
"gravity",
"Drift pattern",
),
size_variance: n(0, 1, 0.5, "Size variance"),
color: c("#2a2a2a", "Color", "opaque variant only"),
custom_shapes: {
kind: "polylines",
minPoints: 8,
maxPoints: 14,
maxShapes: 20,
label: "Drawn shapes",
hint: "user-drawn floater spines, normalized 0 to 1; leave empty for procedural shapes",
},
use_custom_shapes: b(false, "Use drawn shapes"),
},

geometric_aura: {
shapes: {
kind: "list",
minItems: 0,
maxItems: 12,
of: {
shape_type: e(
["zigzag", "fortification", "spiral", "arc", "expanding_ring"] as const,
"fortification",
"Shape type",
"legacy, ignored by the renderer",
),
x: n(0, 1, 0.35, "Horizontal position"),
y: n(0, 1, 0.45, "Vertical position"),
size: n(0.01, 1, 0.2, "Size", { hint: "fraction of the shorter edge" }),
animation_speed: n(0, 5, 1.0, "Animation speed"),
color: c("#ffd700", "Color", "legacy, ignored by the renderer"),
opacity: n(0, 1, 0.8, "Opacity"),
},
default: [
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
label: "Shapes",
},
internal_shimmer: b(false, "Internal shimmer", "legacy, superseded by Shimmer"),
asymmetry: n(0, 1, 0.0, "Asymmetry", { hint: "0 is circular, 1 is a strong crescent" }),
asymmetry_angle: n(0, 360, 0.0, "Asymmetry angle", { unit: "degrees" }),
inner_color: c("#ffffff", "Inner color"),
outer_color: c("#a0c0ff", "Outer color"),
shimmer: b(true, "Shimmer", "scintillation over the field"),
brightness: n(0.1, 1.0, 0.65, "Brightness"),
...SPECTRUM_COLOR_MODE_FIELDS,
},

fortification_spectra: {
origin_x: n(0, 1, 0.5, "Origin horizontal"),
origin_y: n(0, 1, 0.5, "Origin vertical"),
expansion_rate: n(0.1, 200, 2.0, "Expansion rate", { unit: "px per second" }),
arc_angle_degrees: n(10, 360, 120, "Arc angle", { unit: "degrees" }),
zigzag_amplitude: n(1, 100, 14, "Zigzag amplitude", { unit: "px" }),
zigzag_frequency: n(0.5, 30, 6, "Zigzag frequency", { unit: "cycles per 100px" }),
color: c("#ffd700", "Color"),
cycle_duration_seconds: n(10, 7200, 1200, "Cycle length", { unit: "seconds" }),
...COLOR_MODE_FIELDS,
},

photopsia_flashes: {
flash_points: {
kind: "list",
minItems: 0,
maxItems: 20,
of: {
x: n(0, 1, 0.5, "Horizontal position"),
y: n(0, 1, 0.5, "Vertical position"),
},
default: [
{ x: 0.25, y: 0.3 },
{ x: 0.75, y: 0.65 },
],
label: "Flash points",
},
flash_duration_ms: n(20, 2000, 120, "Flash duration", { unit: "ms" }),
flashes_per_minute: n(0, 180, 20, "Flash rate", {
unit: "per minute",
hint: "hard safety cap at 180, which is 3 Hz",
}),
flash_color: c("#ffffff", "Flash color"),
...COLOR_MODE_FIELDS,
},

phosphene_burst: {
burst_rate_per_minute: n(0, 60, 10, "Burst rate", {
unit: "per minute",
hint: "hard safety cap at 60, which is 1 Hz",
}),
shape_type: e(["star", "ring", "ray_burst", "random"] as const, "random", "Shape"),
color: c("#ffffff", "Color"),
size_px: n(10, 200, 60, "Size", { unit: "px" }),
},

scotoma: {
scotomas: {
kind: "list",
minItems: 0,
maxItems: 12,
of: {
x: n(0, 1, 0.6, "Horizontal position"),
y: n(0, 1, 0.4, "Vertical position"),
size: n(0.01, 1, 0.1, "Size"),
shape: e(["circular", "irregular"] as const, "circular", "Shape"),
opacity: n(0, 1, 0.7, "Opacity"),
edge_softness: n(0, 1, 0.5, "Edge softness", {
hint: "legacy, superseded by the layer-level edge softness in px",
}),
seed: n(0, 2147483647, 1, "Seed", {
int: true,
hint: "reproduces the exact irregular outline on replay",
}),
},
default: [
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
label: "Scotomas",
},
fill_color: c("#12080e", "Fill color"),
border_color: c("#2a1535", "Border color"),
edge_softness_px: n(20, 65, 45.0, "Edge softness", { unit: "px" }),
seamless: b(false, "Seamless", "no identifiable boundary; overrides edge softness"),
...SPECTRUM_COLOR_MODE_FIELDS,
},

migrating_scotoma: {
dot_count: n(1, 12, 3, "Count", { int: true }),
dot_size_px: n(4, 60, 18.0, "Size", { unit: "px radius" }),
fill_color: c("#0a0510", "Fill color"),
opacity: n(0, 1, 0.85, "Opacity"),
edge_softness_px: n(0, 60, 8.0, "Edge softness", { unit: "px" }),
path_type: e(
["drift", "orbit", "erratic", "crawl", "swarm"] as const,
"drift",
"Path",
),
speed: n(0.1, 2.0, 0.5, "Speed", { hint: "crawl caps at 0.15 internally" }),
drift_angle: n(0, 360, 45.0, "Drift heading", { unit: "degrees" }),
orbit_radius_percent: n(1, 100, 30.0, "Orbit radius", { unit: "% of shorter edge" }),
},

color_distortion: {
hue_shift: n(-180, 180, 0, "Hue shift", { unit: "degrees" }),
saturation_boost: n(0, 3, 1.0, "Saturation", { hint: "1 is unchanged" }),
contrast: n(0.2, 3, 1.0, "Contrast", { hint: "1 is unchanged" }),
pattern: e(["uniform", "pulsing", "quadrant"] as const, "uniform", "Pattern"),
pulse_speed: n(0, 5, 1.0, "Pulse speed", { hint: "used when pattern is pulsing" }),
quadrant: e(
["top_left", "top_right", "bottom_left", "bottom_right"] as const,
"top_left",
"Quadrant",
"used when pattern is quadrant",
),
},

text_blur: {
blur_type: e(["gaussian", "motion", "radial"] as const, "gaussian", "Blur type"),
blur_radius_px: n(0.5, 20, 4.0, "Blur radius", { unit: "px" }),
coverage: e(["global", "patch"] as const, "global", "Coverage"),
patch_x: n(0, 1, 0.5, "Patch horizontal"),
patch_y: n(0, 1, 0.5, "Patch vertical"),
patch_radius_percent: n(1, 100, 20.0, "Patch radius", { unit: "% of width" }),
pulse: b(false, "Pulse"),
pulse_frequency_hz: n(0.05, 5, 0.5, "Pulse frequency", { unit: "Hz" }),
},

lexical_distortion: {
words_per_second: n(0.1, 10, 1.5, "Activation rate", { unit: "words per second" }),
color_palette: e(["random", "warm", "cool", "spectrum"] as const, "random", "Palette"),
highlight_mode: e(
["color", "highlight", "both"] as const,
"color",
"Highlight mode",
"legacy, superseded by Text mode",
),
text_mode: e(["color_only", "highlight", "both"] as const, "color_only", "Text mode"),
duration_ms: n(100, 5000, 800, "Duration", { unit: "ms" }),
intensity: n(0, 1, 0.7, "Intensity"),
simultaneous_words: n(1, 10, 3, "Words at once", { int: true }),
},

alice_in_wonderland: {
center_x: n(0, 1, 0.5, "Center horizontal"),
center_y: n(0, 1, 0.5, "Center vertical"),
radius_percent: n(2, 60, 22.0, "Radius", { unit: "% of shorter edge" }),
distortion_type: e(["micropsia", "macropsia"] as const, "macropsia", "Distortion"),
intensity: n(0, 1, 0.5, "Intensity", { hint: "1 is about 1.8 times" }),
...SPECTRUM_COLOR_MODE_FIELDS,
},

metamorphopsia: {
wave_amplitude_px: n(0.5, 30, 6.0, "Wave amplitude", { unit: "px" }),
wave_frequency: n(0.5, 12, 3.0, "Wave frequency", { unit: "cycles" }),
coverage: e(["global", "patch"] as const, "patch", "Coverage"),
patch_x: n(0, 1, 0.5, "Patch horizontal"),
patch_y: n(0, 1, 0.5, "Patch vertical"),
patch_radius_percent: n(1, 100, 25.0, "Patch radius", { unit: "% of width" }),
...SPECTRUM_COLOR_MODE_FIELDS,
},

edge_glow: {
detection_threshold: n(0, 255, 30, "Edge sensitivity", {
int: true,
hint: "lower finds more edges",
}),
glow_color: c("#ffffff", "Glow color"),
glow_width_px: n(1, 40, 8.0, "Glow width", { unit: "px" }),
glow_opacity: n(0, 1, 0.6, "Glow opacity"),
chromatic_aberration: b(true, "Prismatic fringe"),
aberration_offset_px: n(0, 12, 3.0, "Fringe offset", { unit: "px" }),
pulse: b(false, "Pulse"),
pulse_frequency_hz: n(0.05, 5, 0.5, "Pulse frequency", { unit: "Hz" }),
...SPECTRUM_COLOR_MODE_FIELDS,
},

photophobia: {
luminance_reduction: n(0, 1, 0.3, "Dimming"),
glare_intensity: n(0, 1, 0.5, "Glare intensity"),
glare_radius: n(0, 0.5, 0.1, "Glare spread", { unit: "fraction of shorter edge" }),
},

hemianopia_mask: {
side: e(["left", "right"] as const, "left", "Side lost"),
edge_softness_px: n(0, 40, 20, "Edge softness", {
unit: "px",
hint: "the boundary never renders narrower than 8px",
}),
fill_opacity: n(0, 1, 0.6, "Fill opacity", {
hint: "above 0.7 switches from a desaturated ghost of the scene to a dark fill",
}),
edge_color: c("#c9c2ec", "Boundary color"),
...SPECTRUM_COLOR_MODE_FIELDS,
},

tunnel_vision: {
radius_percent: n(0, 100, 60, "Remaining field", { unit: "% of radius" }),
edge_softness_px: n(0, 600, 80, "Edge softness", { unit: "px" }),
fill_style: e(["black", "blur"] as const, "black", "Lost field"),
...SPECTRUM_COLOR_MODE_FIELDS,
},

retinal_afterimage: {
trigger_mode: e(["ambient", "gaze", "both"] as const, "ambient", "Trigger"),
spawn_rate_per_minute: n(1, 30, 8.0, "Spawn rate", { unit: "per minute" }),
gaze_dwell_ms: n(300, 5000, 1500, "Gaze dwell", { unit: "ms" }),
gaze_trigger_radius_px: n(10, 120, 40.0, "Gaze radius", { unit: "px" }),
blob_count_max: n(1, 10, 4, "Max at once", { int: true }),
blob_size_px: n(20, 150, 60.0, "Size", { unit: "px radius" }),
hold_duration_ms: n(200, 10000, 2000, "Hold", { unit: "ms" }),
fade_duration_ms: n(200, 10000, 3000, "Fade", { unit: "ms" }),
blob_softness: n(5, 60, 30.0, "Edge softness", { unit: "px" }),
},

palinopsia: {
trail_length: n(0, 1, 0.5, "Trail length"),
decay_speed: n(0.1, 5, 1.0, "Decay speed"),
opacity: n(0, 1, 0.5, "Opacity", { hint: "starting opacity of a fresh ghost" }),
},

afterimage_trail: {
trail_length_frames: n(1, 60, 8, "Trail length", { int: true, unit: "frames" }),
decay_curve: e(["linear", "exponential"] as const, "exponential", "Decay curve"),
opacity_start: n(0, 1, 0.6, "Starting opacity"),
triggers_on: e(["motion", "always"] as const, "motion", "Triggers on"),
},

oscillopsia: {
amplitude_px: n(0, 120, 6, "Amplitude", { unit: "px" }),
frequency_hz: n(0, 10, 2, "Frequency", {
unit: "Hz",
hint: "hard safety cap at 10 Hz, below the photosensitive band",
}),
motion_type: e(
["horizontal", "vertical", "rotational", "combined"] as const,
"horizontal",
"Motion",
),
},
};

export const SAFETY_CAPS: ReadonlyArray<{
layer: LayerType;
field: string;
max: number;
why: string;
}> = [
{
layer: "photopsia_flashes",
field: "flashes_per_minute",
max: 180,
why: "180 per minute is 3 Hz, well below the 15 to 25 Hz photosensitive band",
},
{
layer: "phosphene_burst",
field: "burst_rate_per_minute",
max: 60,
why: "60 per minute is 1 Hz",
},
{
layer: "oscillopsia",
field: "frequency_hz",
max: 10,
why: "capped below the photosensitive flicker band",
},
];
