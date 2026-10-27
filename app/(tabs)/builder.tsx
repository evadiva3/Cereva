
import { useCallback, useEffect, useRef, useState } from "react";
import {
Animated,
PanResponder,
Modal,
Pressable,
ScrollView,
StyleSheet,
Text,
View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { SCENES, hasScenes, sceneDataUri, type Scene } from "@/scenes/scenes";
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
import { rendererFallbackReason, rendererUri } from "@/aura/rendererSource";
import { AuraDrag } from "@/aura/AuraDrag";
import { layerAnchors, movedConfig } from "@/aura/position";
import { availableLayers, useAuraDraft } from "@/aura/useAuraDraft";
import { canResize, resizeFields } from "@/aura/resize";
import { saveAuraVersion, listAuraVersions, getAuraVersion, type AuraVersion } from "@/db/auraVersions";
import { listAttacks, type Attack } from "@/db/attacks";
import { writeAuraImage, writeShareImage } from "@/files";
import { FieldControl, announce } from "@/ui/controls";
import { AURA_DISCLAIMER, colors, radius, space, touch, type as typeScale } from "@/theme";

type Panel = "layers" | "add" | "background";

export default function BuilderScreen(){
const auraRef=useRef<AuraViewHandle>(null);
const params=useLocalSearchParams<{versionId?:string}>();
const loadedVersion=useRef<string | null>(null);
const sourceVersion=useRef<AuraVersion | null>(null);
const [menuOpen,setMenuOpen]=useState(false);
const [versions,setVersions]=useState<AuraVersion[]>([]);
const [recordedAttacks,setRecordedAttacks]=useState<Attack[]>([]);
const draft=useAuraDraft();
const [panel, setPanel]=useState<Panel>("layers");
const [openLayer, setOpenLayer]=useState<LayerType | null>(null);
const [advanced,setAdvanced]=useState(false);
const [caps, setCaps]=useState<RendererCapabilities | null>(null);
const [notice, setNotice]=useState<string | null>(null);
const [busy, setBusy]=useState(false);

const sheetHeight=useRef(new Animated.Value(300)).current;
const sheetGeometry=useRef({available:600,current:300,start:300,initialized:false});
const setSheetHeight=useCallback((height:number) => {
const geometry=sheetGeometry.current;
const next=Math.max(geometry.available * 0.28,Math.min(geometry.available * 0.84,height));
geometry.current=next;
sheetHeight.setValue(next);
},[sheetHeight]);
const sheetGesture=useRef(PanResponder.create({
onStartShouldSetPanResponder:e => e.nativeEvent.locationY < 44,
onMoveShouldSetPanResponder:(_event,gesture) => Math.abs(gesture.dy)>6 && Math.abs(gesture.dy)>Math.abs(gesture.dx),
onPanResponderGrant:() => {
sheetHeight.stopAnimation(value => { sheetGeometry.current.current=value; sheetGeometry.current.start=value; });
void Haptics.selectionAsync();
},
onPanResponderMove:(_event,gesture) => setSheetHeight(sheetGeometry.current.start-gesture.dy),
onPanResponderRelease:(_event,gesture) => {
const geometry=sheetGeometry.current;
const projected=geometry.current-gesture.vy*100;
const stops=[0.28,0.52,0.84].map(fraction => fraction*geometry.available);
const destination=stops.reduce((nearest,value) => Math.abs(value-projected)<Math.abs(nearest-projected) ? value : nearest);
geometry.current=destination;
Animated.spring(sheetHeight,{toValue:destination,useNativeDriver:false,damping:28,stiffness:240,mass:1,isInteraction:false}).start();
},
onPanResponderTerminationRequest:() => false,
})).current;

useEffect(() => {
if(!menuOpen) return;
let alive=true;
Promise.all([listAuraVersions(),listAttacks(50)]).then(([saved,attacks]) => {
if(alive){setVersions(saved);setRecordedAttacks(attacks.filter(attack=>attack.note?.trim()));}
}).catch(()=>setNotice("Could not load saved configurations."));
return ()=>{alive=false;};
},[menuOpen]);
useEffect(() => {
const id=params.versionId;
if(!id || loadedVersion.current === id) return;
let alive=true;
void getAuraVersion(id).then(version => {
if(alive && version){draft.load(version.state);sourceVersion.current=version;loadedVersion.current=id;setPanel("layers");}
}).catch(()=>setNotice("Could not open that configuration."));
return ()=>{alive=false;};
},[params.versionId,draft.load]);

useEffect(() => {
auraRef.current?.setState(draft.state);
}, [draft.state]);

const onWarnings=useCallback((warnings: typeof draft.warnings) => {
const notable=warnings.filter((w) => w.kind === "clamped" || w.kind === "unknown_layer");
if(notable.length > 0 && notable[0]){
setNotice(notable[0].message);
}
}, []);

const onReady=useCallback((c: RendererCapabilities) => {
setCaps(c);
if(!c.secureContext){
const why=rendererFallbackReason();
setNotice(
`Camera off. Loaded ${rendererUri()}, origin ${c.origin || "file://"}, ` +
`secure=${c.secureContext}.${why ? ` Server: ${why}` : ""}`,
);
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

const useScene=useCallback(
async (scene: Scene) => {
void Haptics.selectionAsync();
try {
draft.setBackground(photoBackground(await sceneDataUri(scene)));
} catch {
setNotice("That scene could not be loaded.");
}
},
[draft],
);

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
await saveAuraVersion({ name, state: draft.state, thumbnailPath,sourceAttackId:sourceVersion.current?.sourceAttackId ?? null,provenance:sourceVersion.current?.provenance ?? null });
draft.markSaved();
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
setNotice("Saved.");
}catch(err){
setNotice(`Could not save: ${(err as Error).message}`);
}finally {
setBusy(false);
}
}, [draft]);

const shareGif=useCallback(async () => {
setBusy(true);
setNotice("Recording a few seconds of the aura.");
try {
const gif=await auraRef.current?.recordGif({ frames: 24, fps: 12, scale: 0.5 });
if(!gif) throw new Error("the renderer did not return a gif");
const path=writeShareImage(gif.dataUrl, "aura.gif");
if(!(await Sharing.isAvailableAsync())){
setNotice("Sharing is not available on this device.");
return;
}
setNotice(null);
await Sharing.shareAsync(path, {
mimeType: "image/gif",
dialogTitle: "Share your aura",
UTI: "com.compuserve.gif",
});
}catch(err){
setNotice(`Could not make a gif: ${(err as Error).message}`);
}finally {
setBusy(false);
}
}, []);

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
const canDrag=draft.state.layers.some(layer => layerAnchors(layer).length>0 || canResize(layer));
const selectedLayer=draft.state.layers.find(layer => layer.type === openLayer);
const selectedIsGlobal=selectedLayer && layerAnchors(selectedLayer).length===0 && !canResize(selectedLayer);

return (
<View style={styles.root} onLayout={event => {
const height=event.nativeEvent.layout.height;
const geometry=sheetGeometry.current;
const fraction=geometry.initialized ? geometry.current/geometry.available : 0.48;
geometry.available=height;
geometry.initialized=true;
setSheetHeight(height*fraction);
}}>
<View
style={styles.stage}

>
<AuraView
ref={auraRef}
onReady={onReady}
onWarnings={onWarnings}
onCamera={onCamera}
onError={setNotice}
/>
{canDrag && <AuraDrag layers={draft.state.layers} selected={openLayer} onSelect={setOpenLayer} onChange={draft.setLayerConfig} />}
<View pointerEvents="none" style={styles.dragHint}><Text style={styles.dragHintText}>{selectedIsGlobal ? "This effect fills the scene. Use its adjustments below." : canDrag ? "Drag to move · pinch with two fingers to resize" : "Add an effect or open ⋮ for examples"}</Text></View>

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

<Animated.View style={[styles.sheet,{height:sheetHeight}]}>
<View {...sheetGesture.panHandlers}>
<View style={styles.grabber}
accessible accessibilityRole="adjustable" accessibilityLabel="Aura options panel. Swipe up for more controls, down for more preview."
accessibilityActions={[{name:"increment",label:"Show more controls"},{name:"decrement",label:"Show more preview"}]}
onAccessibilityAction={event => setSheetHeight(sheetGeometry.current.current+(event.nativeEvent.actionName === "increment" ? 80 : -80))}>
<View style={styles.grabberBar} />
<Text style={styles.grabberHint}>Drag to resize</Text>
</View>

<View style={styles.tabs}>
{(["layers", "add", "background"] as Panel[]).map((p) => (
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
<Pressable style={styles.moreButton} onPress={()=>setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Aura examples and saved configurations"><Ionicons name="ellipsis-vertical" size={22} color={colors.text} /></Pressable>
</View>

</View>

<ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
{panel === "layers" ? (
draft.state.layers.length === 0 ? (
<Text style={styles.empty}>
No effects yet. Add one below, or open ⋮ for examples and saved configurations.
</Text>
) : (
draft.state.layers.map((layer) => {
const open=openLayer === layer.type;
const specs=LAYER_FIELD_SPECS[layer.type];
return (
<View key={layer.type} style={styles.layerCard}>
<Pressable
style={styles.layerHeader}
onPress={() => { setOpenLayer(open ? null : layer.type); setAdvanced(false); }}
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

{open ? <View style={styles.layerActions}>
<SmallButton
label={layer.visible ? "Shown" : "Hidden"}
a11y={`${LAYER_LABELS[layer.type]}, ${
layer.visible ? "shown, tap to hide" : "hidden, tap to show"
}`}
active={layer.visible}
onPress={() => draft.toggleLayer(layer.type)}
/>
{advanced && <SmallButton label="Send backward" a11y={`Send ${LAYER_LABELS[layer.type]} backward in the stack`} onPress={() => draft.moveLayer(layer.type, -1)} />}
{advanced && <SmallButton label="Bring forward" a11y={`Bring ${LAYER_LABELS[layer.type]} forward in the stack`} onPress={() => draft.moveLayer(layer.type, 1)} />}
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
</View> : null}

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
{layerAnchors(layer).length>0 && <Text style={styles.presetNote}>Drag the handle to move this effect. Pinch with two fingers to resize it.</Text>}
{advanced && layerAnchors(layer).filter(anchor => anchor.list).map((anchor,index) => <View key={index}>
{(["x","y"] as const).map(axis => <FieldControl key={axis} field={axis} spec={{kind:"number",min:0,max:1,default:0.5,label:`Shape ${index+1} ${axis === "x" ? "horizontal" : "vertical"} position`}} value={anchor[axis]} onChange={(_field,value) => draft.setLayerConfig(layer.type,movedConfig(layer,anchor,axis === "x" ? Number(value)-anchor.x : 0,axis === "y" ? Number(value)-anchor.y : 0))} />)}
</View>)}
{Object.entries(specs).filter(([field])=>!resizeFields(layer).includes(field)).filter(([field,spec]) => advanced || (spec.kind !== "list" && spec.kind !== "polylines" && !spec.hint?.includes("legacy") && !/(_x|_y|seed)$/.test(field))).filter((_entry,index) => advanced || index<5).map(([field, spec]) => (
<FieldControl
key={field}
field={field}
spec={spec.kind === "list" && canResize(layer) ? {...spec,of:Object.fromEntries(Object.entries(spec.of).filter(([key])=>key !== "size"))} : spec}
value={(layer.config as unknown as Record<string, unknown>)[field]}
onChange={(f, v) => draft.setLayerField(layer.type, f, v)}
/>
))}
<Pressable style={styles.addRow} onPress={() => setAdvanced(value => !value)} accessibilityRole="button" accessibilityState={{expanded:advanced}}><Text style={styles.addRowText}>{advanced ? "Fewer adjustments" : "More adjustments"}</Text></Pressable>
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
{hasScenes() ? (
<>
<Text style={styles.presetNote}>
Built in scenes. No camera or photo permission needed.
</Text>
{SCENES.map((scene) => (
<Pressable
key={scene.id}
style={styles.addRow}
onPress={() => void useScene(scene)}
accessibilityRole="button"
accessibilityLabel={`${scene.label}. ${scene.hint}`}
>
<Text style={styles.addRowText} maxFontSizeMultiplier={2}>
{scene.label}
</Text>
<Text style={styles.addRowHint} maxFontSizeMultiplier={2}>
{scene.hint}
</Text>
</Pressable>
))}
</>
) : null}
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

<View style={styles.footer}>
{}
<FooterButton label="Image" onPress={share} disabled={busy} />
<FooterButton label="GIF" onPress={shareGif} disabled={busy} />
<FooterButton label="Save" primary onPress={save} disabled={busy || !draft.dirty} />
</View>
</Animated.View>
<Modal visible={menuOpen} transparent animationType="fade" onRequestClose={()=>setMenuOpen(false)}>
<View style={styles.menuBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={()=>setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close aura menu" />
<View style={styles.menu} accessibilityViewIsModal>
<View style={styles.menuHeading}><Text style={styles.presetName}>Your aura collection</Text><Pressable style={styles.moreButton} onPress={()=>setMenuOpen(false)} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" color={colors.text} size={22} /></Pressable></View>
<ScrollView>
<Pressable style={styles.addRow} onPress={()=>{setMenuOpen(false);router.push("/describe");}} accessibilityRole="button"><Text style={styles.addRowText}>Describe in words</Text><Text style={styles.addRowHint}>Describe what you see, or use a recording below.</Text></Pressable>
<Text style={styles.menuLabel}>SAVED CONFIGURATIONS</Text>
{versions.length ? versions.map(version=><Pressable key={version.id} style={styles.addRow} onPress={()=>{draft.load(version.state);sourceVersion.current=version;setOpenLayer(null);setMenuOpen(false);setPanel("layers");}} accessibilityRole="button"><Text style={styles.addRowText}>{version.name}</Text><Text style={styles.addRowHint}>{version.state.layers.length} effects{version.provenance ? " · drafted" : ""}</Text></Pressable>) : <Text style={styles.presetNote}>Save an aura and it will appear here.</Text>}
<Text style={styles.menuLabel}>EXAMPLES TO TRY</Text>
{AURA_PRESETS.map(example=><Pressable key={example.id} style={styles.addRow} onPress={()=>{sourceVersion.current=null;draft.loadPreset(example.id);setMenuOpen(false);setPanel("layers");setOpenLayer(null);}} accessibilityRole="button"><Text style={styles.addRowText}>{example.name}</Text><Text style={styles.addRowHint}>{example.description}</Text></Pressable>)}
<Text style={styles.menuLabel}>FROM YOUR ATTACK RECORDINGS</Text>
{recordedAttacks.length ? recordedAttacks.map(attack=><Pressable key={attack.id} style={styles.addRow} onPress={()=>{setMenuOpen(false);router.push({pathname:"/describe",params:{attackId:attack.id}});}} accessibilityRole="button"><Text style={styles.addRowText}>{new Date(attack.startedAt).toLocaleDateString(undefined,{month:"short",day:"numeric"})} · Create aura draft</Text><Text style={styles.addRowHint} numberOfLines={2}>{attack.note}</Text></Pressable>) : <Text style={styles.presetNote}>Record an attack to use your spoken description here.</Text>}
</ScrollView>
</View></View>
</Modal>
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
moreButton:{minWidth:44,minHeight:56,alignItems:"center",justifyContent:"center"},
menuBackdrop:{flex:1,backgroundColor:"rgba(0,0,0,.65)",justifyContent:"center",padding:20},
menu:{maxHeight:"85%",backgroundColor:colors.surface,borderRadius:18,borderWidth:1,borderColor:colors.lineStrong,overflow:"hidden"},
menuHeading:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingLeft:16},
menuLabel:{color:colors.accent,fontSize:11,letterSpacing:1,paddingHorizontal:16,paddingTop:20,paddingBottom:8},
dragHint: { position: "absolute", top: 12, left: 16, right: 16, alignItems: "center" },
dragHintText: { color: colors.textMuted, backgroundColor: "rgba(9,11,12,0.8)", padding: 8, borderRadius: 8, fontSize: 12 },
root: { flex: 1, backgroundColor: colors.canvas },
stage: { flex: 1, minHeight:0, backgroundColor: colors.auraBackdrop },
sheet: { flexShrink:0, backgroundColor:colors.surface,borderTopLeftRadius:20,borderTopRightRadius:20,borderWidth:1,borderColor:colors.lineStrong,overflow:"hidden" },
grabberHint: { color:colors.textFaint,fontSize:11 },
grabber: { height: 44, gap:5, alignItems: "center", justifyContent: "center" },
grabberBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong },

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
