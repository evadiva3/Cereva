
export interface AuraPreset {
id: string;
name: string;
description: string;
input: Record<string, unknown>;
}

const layer=(type: string, config: Record<string, unknown>={}) => ({
type,
visible: true,
opacity: 1,
config,
});

export const AURA_PRESETS: readonly AuraPreset[]=[
{
id: "static",
name: "Static over everything",
description: "Fine grain across the whole field, like television static that never turns off.",
input: {
layers: [layer("visual_snow", { density: 4200, intensity: 0.75, brightness: 0.5 })],
},
},
{
id: "shimmering_arc",
name: "Shimmering arc",
description:
"A bright jagged crescent that grows outward from one point over about twenty minutes.",
input: {
layers: [
layer("fortification_spectra", {
origin_x: 0.42,
origin_y: 0.5,
expansion_rate: 3.0,
arc_angle_degrees: 140,
cycle_duration_seconds: 90,
}),
layer("geometric_aura", {
shapes: [{ x: 0.42, y: 0.5, size: 0.16, opacity: 0.7 }],
shimmer: true,
brightness: 0.6,
}),
],
},
},
{
id: "blind_spot",
name: "Blind spot",
description: "A soft-edged gap in the field, with a few smaller ones drifting across it.",
input: {
layers: [
layer("scotoma", {
scotomas: [{ x: 0.55, y: 0.45, size: 0.13, shape: "irregular", opacity: 0.8, seed: 7 }],
seamless: true,
}),
layer("migrating_scotoma", { dot_count: 3, dot_size_px: 14, speed: 0.4 }),
],
},
},
{
id: "trails",
name: "Trails behind movement",
description: "Moving things leave a fading copy of themselves behind.",
input: {
layers: [
layer("afterimage_trail", { trail_length_frames: 14, opacity_start: 0.5 }),
layer("palinopsia", { trail_length: 0.6, decay_speed: 0.8, opacity: 0.45 }),
],
},
},
{
id: "light_hurts",
name: "Light hurts",
description: "Everything is too bright, and edges give off a glow.",
input: {
layers: [
layer("photophobia", { luminance_reduction: 0.25, glare_intensity: 0.6, glare_radius: 0.14 }),
layer("edge_glow", { glow_width_px: 10, glow_opacity: 0.5, chromatic_aberration: true }),
],
},
},
{
id: "floaters",
name: "Floaters",
description: "Stringy shapes that drift across the field and settle when you stop moving.",
input: {
layers: [
layer("eye_floaters", { count: 8, variant: "translucent", drift_speed: 0.35 }),
],
},
},
{
id: "half_missing",
name: "Half the field missing",
description: "One side of the view is simply not there.",
input: {
layers: [layer("hemianopia_mask", { side: "left", fill_opacity: 0.55, edge_softness_px: 24 })],
},
},
{
id: "wavy_lines",
name: "Wavy lines",
description: "Straight edges bend and ripple in one part of the view.",
input: {
layers: [
layer("metamorphopsia", {
wave_amplitude_px: 9,
wave_frequency: 4,
coverage: "patch",
patch_radius_percent: 32,
}),
],
},
},
];

export const ALL_LAYERS_STRESS_INPUT: Record<string, unknown>={
layers: [
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
].map((t) => layer(t)),
};

export const HEAVY_REALISTIC_INPUT: Record<string, unknown>={
layers: [
layer("visual_snow", { density: 5000 }),
layer("eye_floaters", { count: 8 }),
layer("geometric_aura"),
layer("scotoma"),
layer("photophobia"),
layer("edge_glow"),
layer("palinopsia"),
layer("oscillopsia"),
],
};
