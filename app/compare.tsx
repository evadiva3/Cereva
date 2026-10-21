
import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { LAYER_FIELD_SPECS, LAYER_LABELS, type LayerType } from "@aura/schema";
import { AuraView, type AuraViewHandle } from "@/aura/AuraView";
import { getAuraVersion, type AuraVersion } from "@/db/auraVersions";
import { colors, radius, space, type as typeScale } from "@/theme";

interface Difference {
label: string;
detail: string;
}

function describeDifferences(a: AuraVersion, b: AuraVersion): Difference[] {
const out: Difference[]=[];
const aTypes=new Set(a.state.layers.map((l) => l.type));
const bTypes=new Set(b.state.layers.map((l) => l.type));

for(const t of bTypes){
if(!aTypes.has(t)){
out.push({ label: LAYER_LABELS[t as LayerType], detail: "added in the later version" });
}
}
for(const t of aTypes){
if(!bTypes.has(t)){
out.push({ label: LAYER_LABELS[t as LayerType], detail: "not in the later version" });
}
}

for(const layerA of a.state.layers){
const layerB=b.state.layers.find((l) => l.type === layerA.type);
if(!layerB) continue;

if(layerA.opacity !== layerB.opacity){
out.push({
label: LAYER_LABELS[layerA.type],
detail: `opacity ${layerA.opacity} to ${layerB.opacity}`,
});
}

const specs=LAYER_FIELD_SPECS[layerA.type];
const configA=layerA.config as unknown as Record<string, unknown>;
const configB=layerB.config as unknown as Record<string, unknown>;
for(const [field, spec] of Object.entries(specs)){
if(spec.kind === "list" || spec.kind === "polylines"){
const lenA=Array.isArray(configA[field]) ? (configA[field] as unknown[]).length : 0;
const lenB=Array.isArray(configB[field]) ? (configB[field] as unknown[]).length : 0;
if(lenA !== lenB){
out.push({
label: LAYER_LABELS[layerA.type],
detail: `${spec.label.toLowerCase()} ${lenA} to ${lenB}`,
});
}
continue;
}
if(configA[field] !== configB[field]){
out.push({
label: LAYER_LABELS[layerA.type],
detail: `${spec.label.toLowerCase()} ${String(configA[field])} to ${String(configB[field])}`,
});
}
}
}

return out;
}

export default function CompareScreen(){
const { a: idA, b: idB }=useLocalSearchParams<{ a: string; b: string }>();
const [pair, setPair]=useState<[AuraVersion, AuraVersion] | null>(null);
const [error, setError]=useState<string | null>(null);
const refA=useRef<AuraViewHandle>(null);
const refB=useRef<AuraViewHandle>(null);

useEffect(() => {
let cancelled=false;
Promise.all([getAuraVersion(idA), getAuraVersion(idB)])
.then(([va, vb]) => {
if(cancelled) return;
if(!va || !vb){
setError("One of those versions could not be found.");
return;
}
setPair(va.createdAt <= vb.createdAt ? [va, vb] : [vb, va]);
})
.catch((err: Error) => !cancelled && setError(err.message));
return () => {
cancelled=true;
};
}, [idA, idB]);

useEffect(() => {
if(!pair) return;
for(const [ref, version] of [
[refA, pair[0]],
[refB, pair[1]],
] as const){
ref.current?.setQuality({ maxDpr: 1.5, depthOfField: false });
ref.current?.setState(version.state);
}
}, [pair]);

if(error){
return (
<View style={styles.center}>
<Text style={styles.muted}>{error}</Text>
</View>
);
}

if(!pair){
return (
<View style={styles.center}>
<Text style={styles.muted}>Loading</Text>
</View>
);
}

const [earlier, later]=pair;
const differences=describeDifferences(earlier, later);

return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<View style={styles.stages}>
<View style={styles.stage}>
<AuraView ref={refA} pointerEventsNone />
<Text style={styles.stageLabel} maxFontSizeMultiplier={1.8}>
{new Date(earlier.createdAt).toLocaleDateString()}
</Text>
</View>
<View style={styles.stage}>
<AuraView ref={refB} pointerEventsNone />
<Text style={styles.stageLabel} maxFontSizeMultiplier={1.8}>
{new Date(later.createdAt).toLocaleDateString()}
</Text>
</View>
</View>

<Text style={styles.heading} maxFontSizeMultiplier={2}>
What changed
</Text>

{differences.length === 0 ? (
<Text style={styles.muted}>
These two are identical in every setting.
</Text>
) : (
differences.map((d, i) => (
<View key={`${d.label}-${i}`} style={styles.diffRow}>
<Text style={styles.diffLabel} maxFontSizeMultiplier={2}>
{d.label}
</Text>
<Text style={styles.diffDetail} maxFontSizeMultiplier={2}>
{d.detail}
</Text>
</View>
))
)}

<Text style={styles.note}>
These are differences in what you drew, not measurements of your
symptoms. The app does not judge whether anything got better or worse.
</Text>
</ScrollView>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { paddingBottom: space.xxl },
center: {
flex: 1,
backgroundColor: colors.canvas,
alignItems: "center",
justifyContent: "center",
padding: space.xl,
},
stages: { flexDirection: "row", height: 320, gap: 2 },
stage: { flex: 1, backgroundColor: colors.auraBackdrop },
stageLabel: {
position: "absolute",
bottom: space.sm,
alignSelf: "center",
color: colors.textMuted,
fontSize: typeScale.caption,
backgroundColor: "rgba(12,12,16,0.75)",
paddingHorizontal: space.sm,
paddingVertical: 2,
borderRadius: radius.sm,
overflow: "hidden",
},
heading: {
color: colors.text,
fontSize: typeScale.heading,
paddingHorizontal: space.lg,
paddingTop: space.xl,
paddingBottom: space.sm,
},
muted: { color: colors.textMuted, fontSize: typeScale.body, paddingHorizontal: space.lg },
diffRow: {
paddingHorizontal: space.lg,
paddingVertical: space.md,
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},
diffLabel: { color: colors.text, fontSize: typeScale.label },
diffDetail: { color: colors.textMuted, fontSize: typeScale.caption, marginTop: 2 },
note: {
color: colors.textFaint,
fontSize: typeScale.caption,
padding: space.xl,
textAlign: "center",
},
});
