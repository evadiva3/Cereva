
import { useCallback, useEffect, useRef, useState } from "react";
import {
Pressable,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";

import {
AURA_PRESETS,
LAYER_FIELD_SPECS,
LAYER_LABELS,
cameraBackground,
neutralBackground,
photoBackground,
readingPassageBackground,
type BackgroundType,
type CameraReport,
type LayerType,
type RendererCapabilities,
} from "@aura/schema";

import { AuraView, type AuraViewHandle } from "@/aura/AuraView";
import { availableLayers, useAuraDraft } from "@/aura/useAuraDraft";
import { saveAuraVersion } from "@/db/auraVersions";
import { writeAuraImage, writeShareImage } from "@/files";
import { FieldControl, announce } from "@/ui/controls";
import { AURA_DISCLAIMER, colors, radius, space, touch, type as typeScale } from "@/theme";

type Panel = "layers" | "add" | "presets" | "background";

export default function BuilderScreen(){
const auraRef=useRef<AuraViewHandle>(null);
const draft=useAuraDraft();
const [panel, setPanel]=useState<Panel>("layers");
const [openLayer, setOpenLayer]=useState<LayerType | null>(null);
const [caps, setCaps]=useState<RendererCapabilities | null>(null);
const [notice, setNotice]=useState<string | null>(null);
const [busy, setBusy]=useState(false);

useEffect(() => {
auraRef.current?.setState(draft.state);
}, [draft.state]);

const onWarnings=useCallback((warnings: typeof draft.warnings) => {
const notable=warnings.filter((w) => w.kind === "clamped" || w.kind === "unknown_layer");
if(notable.length > 0 && notable[0]){
setNotice(notable[0].message);
}
}, []);

const onCamera=useCallback((report: CameraReport) => {
if(report.status === "live"){
setNotice(null);
return;
}
if(report.status === "denied"){
setNotice("Camera access was refused. You can change that in Settings.");
return;
}
if(report.status === "unsupported" || !report.mediaDevicesPresent){
setNotice(
"The camera is not available to the renderer on this build. " +
"This is the known web view limitation, see docs/CAMERA.md.",
);
return;
}
setNotice(`The camera did not start (${report.status}).`);
}, []);

const pickPhoto=useCallback(async () => {
const res=await ImagePicker.launchImageLibraryAsync({
mediaTypes: ["images"],
quality: 0.9,
base64: true,
});
if(res.canceled || !res.assets[0]) return;
const asset=res.assets[0];
if(asset.base64){
const SAFE_IMAGE_TYPES=["image/jpeg", "image/png", "image/heic", "image/webp"];
const mime=asset.mimeType ?? "image/jpeg";
if(!SAFE_IMAGE_TYPES.includes(mime)){
setNotice("That image format is not supported.");
return;
}
draft.setBackground(photoBackground(`data:${mime};base64,${asset.base64}`));
}else{
setNotice("That photo could not be read.");
}
}, [draft]);

const setBackground=useCallback(
(type: BackgroundType) => {
void Haptics.selectionAsync();
if(type === "photo"){
void pickPhoto();
return;
}
if(type === "camera") draft.setBackground(cameraBackground());
else if(type === "reading_passage") draft.setBackground(readingPassageBackground());
else draft.setBackground(neutralBackground());
},
[draft, pickPhoto],
);

const save=useCallback(async () => {
if(draft.state.layers.length === 0){
setNotice("Add at least one layer before saving.");
return;
}
setBusy(true);
try {
let thumbnailPath: string | null=null;
try {
const shot=await auraRef.current?.snapshot();
if(shot){
thumbnailPath=writeAuraImage(shot.dataUrl, `${Date.now()}.png`);
}
}catch {
thumbnailPath=null;
}

const name=new Date().toLocaleDateString(undefined, {
year: "numeric",
month: "short",
day: "numeric",
});
await saveAuraVersion({ name, state: draft.state, thumbnailPath });
draft.markSaved();
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
setNotice("Saved.");
}catch(err){
setNotice(`Could not save: ${(err as Error).message}`);
}finally {
setBusy(false);
}
}, [draft]);

const share=useCallback(async () => {
setBusy(true);
try {
const shot=await auraRef.current?.snapshot();
if(!shot) throw new Error("the renderer did not return an image");
const path=writeShareImage(shot.dataUrl);
if(!(await Sharing.isAvailableAsync())){
setNotice("Sharing is not available on this device.");
return;
}
await Sharing.shareAsync(path, {
mimeType: "image/png",
dialogTitle: "Share your aura",
});
}catch(err){
setNotice(`Could not share: ${(err as Error).message}`);
}finally {
setBusy(false);
}
}, []);

const bg=draft.state.background.background_type;

return (
<View style={styles.root}>
<View style={styles.stage}>
<AuraView
ref={auraRef}
onReady={setCaps}
onWarnings={onWarnings}
onCamera={onCamera}
onError={setNotice}
/>
<Pressable
style={styles.attackButton}
onPress={() => {
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
router.push("/attack");
}}
accessibilityRole="button"
accessibilityLabel="Log a migraine attack starting now"
>
<Text style={styles.attackButtonText}>Attack</Text>
</Pressable>
<Pressable
style={styles.showButton}
onPress={() => {
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
router.push("/show");
}}
accessibilityRole="button"
accessibilityLabel="Show mode, full screen over the live camera"
>
<Text style={styles.showButtonText}>Show someone</Text>
</Pressable>
</View>

{notice ? (
<Pressable
style={styles.notice}
onPress={() => setNotice(null)}
accessibilityRole="button"
accessibilityLabel={`${notice}. Tap to dismiss.`}
>
<Text style={styles.noticeText}>{notice}</Text>
</Pressable>
) : null}

<View style={styles.tabs}>
{(["layers", "add", "presets", "background"] as Panel[]).map((p) => (
<Pressable
key={p}
onPress={() => {
void Haptics.selectionAsync();
setPanel(p);
}}
style={[styles.tab, panel === p && styles.tabSelected]}
accessibilityRole="tab"
accessibilityState={{ selected: panel === p }}
accessibilityLabel={p === "add" ? "Add a layer" : p}
>
<Text
style={[styles.tabText, panel === p && styles.tabTextSelected]}
maxFontSizeMultiplier={2}
>
{p === "add" ? "Add" : p.charAt(0).toUpperCase() + p.slice(1)}
</Text>
</Pressable>
))}
</View>

<ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
{panel === "layers" ? (
draft.state.layers.length === 0 ? (
<Text style={styles.empty}>
No layers yet. Start from a preset, or add one.
</Text>
) : (
draft.state.layers.map((layer, i) => {
const open=openLayer === layer.type;
const specs=LAYER_FIELD_SPECS[layer.type];
return (
<View key={layer.type} style={styles.layerCard}>
<Pressable
style={styles.layerHeader}
onPress={() => setOpenLayer(open ? null : layer.type)}
accessibilityRole="button"
accessibilityState={{ expanded: open }}
accessibilityLabel={`${LAYER_LABELS[layer.type]}, ${
layer.visible ? "shown" : "hidden"
}. Tap to ${open ? "collapse" : "expand"} its controls.`}
>
<Text style={styles.layerName} maxFontSizeMultiplier={2}>
{LAYER_LABELS[layer.type]}
</Text>
<Text style={styles.layerChevron}>{open ? "Hide" : "Edit"}</Text>
</Pressable>

<View style={styles.layerActions}>
<SmallButton
label={layer.visible ? "Shown" : "Hidden"}
a11y={`${LAYER_LABELS[layer.type]}, ${
layer.visible ? "shown, tap to hide" : "hidden, tap to show"
}`}
active={layer.visible}
onPress={() => draft.toggleLayer(layer.type)}
/>
<SmallButton
label="Up"
a11y={`Move ${LAYER_LABELS[layer.type]} down in the stack`}
disabled={i === 0}
onPress={() => draft.moveLayer(layer.type, -1)}
/>
<SmallButton
label="Down"
a11y={`Move ${LAYER_LABELS[layer.type]} up in the stack`}
disabled={i === draft.state.layers.length - 1}
onPress={() => draft.moveLayer(layer.type, 1)}
/>
<SmallButton
label="Remove"
a11y={`Remove ${LAYER_LABELS[layer.type]}`}
danger
onPress={() => {
draft.removeLayer(layer.type);
if(openLayer === layer.type) setOpenLayer(null);
announce(`${LAYER_LABELS[layer.type]} removed`);
}}
/>
</View>

{open ? (
<View style={styles.layerFields}>
<FieldControl
field="__opacity"
spec={{
kind: "number",
min: 0,
max: 1,
default: 1,
label: "Layer opacity",
}}
value={layer.opacity}
onChange={(_f, v) => draft.setLayerOpacity(layer.type, v as number)}
/>
{Object.entries(specs).map(([field, spec]) => (
<FieldControl
key={field}
field={field}
spec={spec}
value={(layer.config as unknown as Record<string, unknown>)[field]}
onChange={(f, v) => draft.setLayerField(layer.type, f, v)}
/>
))}
</View>
) : null}
</View>
);
})
)
) : null}

{panel === "add" ? (
availableLayers(draft.state).length === 0 ? (
<Text style={styles.empty}>Every layer is already in this aura.</Text>
) : (
availableLayers(draft.state).map(({ type, label }) => (
<Pressable
key={type}
style={styles.addRow}
onPress={() => {
draft.addLayer(type);
announce(`${label} added`);
setPanel("layers");
setOpenLayer(type);
}}
accessibilityRole="button"
accessibilityLabel={`Add ${label}`}
>
<Text style={styles.addRowText} maxFontSizeMultiplier={2}>
{label}
</Text>
</Pressable>
))
)
) : null}

{panel === "presets" ? (
<>
<Text style={styles.presetNote}>
Starting points, not descriptions of anyone in particular. Adjust
anything.
</Text>
{AURA_PRESETS.map((p) => (
<Pressable
key={p.id}
style={styles.presetCard}
onPress={() => {
draft.loadPreset(p.id);
announce(`${p.name} loaded`);
setPanel("layers");
}}
accessibilityRole="button"
accessibilityLabel={`${p.name}. ${p.description}`}
>
<Text style={styles.presetName} maxFontSizeMultiplier={2}>
{p.name}
</Text>
<Text style={styles.presetDesc} maxFontSizeMultiplier={2}>
{p.description}
</Text>
</Pressable>
))}
</>
) : null}

{panel === "background" ? (
<>
{(
[
["neutral", "Dark field", "No permission needed."],
["photo", "Your photo", "Stays on this device."],
["camera", "Live camera", "What show mode uses."],
["reading_passage", "Reading page", "Shows reading difficulty."],
] as [BackgroundType, string, string][]
).map(([type, label, hint]) => (
<Pressable
key={type}
style={[styles.addRow, bg === type && styles.addRowSelected]}
onPress={() => setBackground(type)}
accessibilityRole="radio"
accessibilityState={{ selected: bg === type }}
accessibilityLabel={`${label}. ${hint}`}
>
<Text style={styles.addRowText} maxFontSizeMultiplier={2}>
{label}
</Text>
<Text style={styles.addRowHint} maxFontSizeMultiplier={2}>
{hint}
</Text>
</Pressable>
))}
{caps && caps.compositeReadingLayers.length > 0 ? (
<Text style={styles.presetNote}>
{caps.compositeReadingLayers.length} layers transform the scene
itself rather than drawing on top of it. They need the
background inside the renderer to work.
</Text>
) : null}
</>
) : null}

<Text style={styles.disclaimer}>{AURA_DISCLAIMER}</Text>
</ScrollView>

<ScrollView
horizontal
showsHorizontalScrollIndicator={false}
style={styles.navRow}
contentContainerStyle={styles.navContent}
accessibilityRole="tablist"
>
{(
[
["Check in", "/checkin"],
["Loosen", "/loosen"],
["Insights", "/insights"],
["Describe", "/describe"],
["Versions", "/versions"],
["Settings", "/settings"],
] as const
).map(([label, path]) => (
<Pressable
key={path}
style={({ pressed }) => [styles.navChip, pressed && styles.navChipPressed]}
onPress={() => router.push(path)}
accessibilityRole="button"
accessibilityLabel={label}
>
<Text style={styles.navChipText} maxFontSizeMultiplier={1.8}>
{label}
</Text>
</Pressable>
))}
</ScrollView>

<View style={styles.footer}>
{}
<FooterButton label="Share image" onPress={share} disabled={busy} />
<FooterButton label="Save" primary onPress={save} disabled={busy || !draft.dirty} />
</View>
</View>
);
}

function SmallButton({
label,
a11y,
onPress,
disabled,
active,
danger,
}: {
label: string;
a11y: string;
onPress: () => void;
disabled?: boolean;
active?: boolean;
danger?: boolean;
}){
return (
<Pressable
onPress={() => {
void Haptics.selectionAsync();
onPress();
}}
disabled={disabled}
style={({ pressed }) => [
styles.smallButton,
active && styles.smallButtonActive,
pressed && styles.smallButtonPressed,
disabled && styles.smallButtonDisabled,
]}
accessibilityRole="button"
accessibilityLabel={a11y}
accessibilityState={{ disabled: !!disabled }}
>
<Text
style={[styles.smallButtonText, danger && styles.smallButtonTextDanger]}
maxFontSizeMultiplier={1.8}
>
{label}
</Text>
</Pressable>
);
}

function FooterButton({
label,
onPress,
primary,
disabled,
}: {
label: string;
onPress: () => void;
primary?: boolean;
disabled?: boolean;
}){
return (
<Pressable
onPress={onPress}
disabled={disabled}
style={({ pressed }) => [
styles.footerButton,
primary && styles.footerButtonPrimary,
pressed && styles.footerButtonPressed,
disabled && styles.footerButtonDisabled,
]}
accessibilityRole="button"
accessibilityLabel={label}
accessibilityState={{ disabled: !!disabled }}
>
<Text
style={[styles.footerButtonText, primary && styles.footerButtonTextPrimary]}
maxFontSizeMultiplier={1.8}
>
{label}
</Text>
</Pressable>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
stage: { height: "42%", backgroundColor: colors.auraBackdrop },
attackButton: {
position: "absolute",
left: space.lg,
bottom: space.lg,
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.pill,
backgroundColor: "rgba(40,24,24,0.85)",
borderWidth: 1,
borderColor: colors.danger,
},
attackButtonText: { color: colors.danger, fontSize: typeScale.label },
showButton: {
position: "absolute",
right: space.lg,
bottom: space.lg,
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.pill,
backgroundColor: "rgba(20,20,26,0.82)",
borderWidth: 1,
borderColor: colors.lineStrong,
},
showButtonText: { color: colors.text, fontSize: typeScale.label },

notice: {
backgroundColor: colors.surfaceRaised,
paddingVertical: space.md,
paddingHorizontal: space.lg,
minHeight: touch.min,
justifyContent: "center",
},
noticeText: { color: colors.warn, fontSize: typeScale.label },

tabs: {
flexDirection: "row",
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},
tab: {
flex: 1,
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderBottomWidth: 2,
borderBottomColor: "transparent",
},
tabSelected: { borderBottomColor: colors.accent },
tabText: { color: colors.textMuted, fontSize: typeScale.label },
tabTextSelected: { color: colors.text },

panel: { flex: 1 },
panelContent: { paddingBottom: space.xxl },
empty: { color: colors.textMuted, fontSize: typeScale.body, padding: space.xl },

layerCard: {
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},
layerHeader: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
minHeight: touch.comfortable,
paddingHorizontal: space.lg,
},
layerName: { color: colors.text, fontSize: typeScale.body, flex: 1 },
layerChevron: { color: colors.accent, fontSize: typeScale.label },
layerActions: {
flexDirection: "row",
gap: space.sm,
paddingHorizontal: space.lg,
paddingBottom: space.md,
flexWrap: "wrap",
},
layerFields: { backgroundColor: colors.surface },

smallButton: {
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.md,
borderRadius: radius.sm,
backgroundColor: colors.surfaceRaised,
},
smallButtonActive: { backgroundColor: colors.accentDim },
smallButtonPressed: { opacity: 0.7 },
smallButtonDisabled: { opacity: 0.35 },
smallButtonText: { color: colors.text, fontSize: typeScale.caption },
smallButtonTextDanger: { color: colors.danger },

addRow: {
minHeight: touch.comfortable,
justifyContent: "center",
paddingHorizontal: space.lg,
paddingVertical: space.md,
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},
addRowSelected: { backgroundColor: colors.surface },
addRowText: { color: colors.text, fontSize: typeScale.body },
addRowHint: { color: colors.textFaint, fontSize: typeScale.caption, marginTop: 2 },

presetNote: {
color: colors.textFaint,
fontSize: typeScale.caption,
paddingHorizontal: space.lg,
paddingVertical: space.md,
},
presetCard: {
paddingHorizontal: space.lg,
paddingVertical: space.md,
minHeight: touch.comfortable,
justifyContent: "center",
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},
presetName: { color: colors.text, fontSize: typeScale.body },
presetDesc: { color: colors.textMuted, fontSize: typeScale.caption, marginTop: 2 },

disclaimer: {
color: colors.textFaint,
fontSize: typeScale.caption,
padding: space.xl,
textAlign: "center",
},

navRow: {
flexGrow: 0,
borderTopWidth: StyleSheet.hairlineWidth,
borderTopColor: colors.line,
},
navContent: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm },
navChip: {
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.pill,
backgroundColor: colors.surfaceRaised,
},
navChipPressed: { opacity: 0.7 },
navChipText: { color: colors.textMuted, fontSize: typeScale.label },

footer: {
flexDirection: "row",
gap: space.sm,
padding: space.md,
borderTopWidth: StyleSheet.hairlineWidth,
borderTopColor: colors.line,
},
footerButton: {
flex: 1,
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
},
footerButtonPrimary: { backgroundColor: colors.accent },
footerButtonPressed: { opacity: 0.7 },
footerButtonDisabled: { opacity: 0.4 },
footerButtonText: { color: colors.text, fontSize: typeScale.label, textAlign: "center" },
footerButtonTextPrimary: { color: colors.accentText },
});
