
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Brightness from "expo-brightness";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import {
describeTensionDrop,
tensionDrop,
} from "../packages/loosen/src/schedule";
import { scriptForSeconds, type ScriptStep } from "../packages/loosen/src/scripts";
import { finishSession, startSession } from "@/db/loosenSessions";
import { makeNarrator, SCREEN_LOCK_NOTE, type Narrator } from "@/loosen/narrator";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

type Phase = "before" | "running" | "after" | "done";

const SESSION_BRIGHTNESS=0.1;

export default function LoosenPlayerScreen(){
useKeepAwake();
const { seconds }=useLocalSearchParams<{ seconds?: string }>();
const script=scriptForSeconds(Number(seconds) || 300);

const [phase, setPhase]=useState<Phase>("before");
const [stepIndex, setStepIndex]=useState(0);
const [tensionBefore, setTensionBefore]=useState<number | null>(null);
const [tensionAfter, setTensionAfter]=useState<number | null>(null);
const [error, setError]=useState<string | null>(null);

const sessionId=useRef<string | null>(null);
const narrator=useRef<Narrator | null>(null);
const timer=useRef<ReturnType<typeof setTimeout> | null>(null);
const prevBright=useRef<number | null>(null);
const stepIndexRef=useRef(0);
stepIndexRef.current=stepIndex;

useEffect(() => {
if(phase !== "running") return;
let cancelled=false;
(async () => {
try {
const { status }=await Brightness.requestPermissionsAsync();
if(status !== "granted" || cancelled) return;
prevBright.current=await Brightness.getBrightnessAsync();
await Brightness.setBrightnessAsync(SESSION_BRIGHTNESS);
}catch {}
})();
return () => {
cancelled=true;
const prev=prevBright.current;
if(prev !== null) Brightness.setBrightnessAsync(prev).catch(() => {});
};
}, [phase]);

useEffect(() => {
const sub=AppState.addEventListener("change", (state) => {
if(state !== "active") narrator.current?.stop();
});
return () => sub.remove();
}, []);

useEffect(() => {
return () => {
if(timer.current) clearTimeout(timer.current);
narrator.current?.stop();
};
}, []);

const pulse=useCallback((kind: ScriptStep["haptic"]) => {
if(kind === "tense"){
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}else if(kind === "release"){
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 160);
}
}, []);

const runStep=useCallback(
(index: number) => {
const step=script.steps[index];
if(!step){
setPhase("after");
return;
}
setStepIndex(index);
pulse(step.haptic);
void narrator.current?.say(step.say, step.id);
timer.current=setTimeout(() => runStep(index + 1), step.seconds * 1000);
},
[script, pulse],
);

const begin=useCallback(async () => {
try {
const session=await startSession(script.totalSeconds, tensionBefore);
sessionId.current=session.id;
narrator.current=await makeNarrator(true);
setPhase("running");
runStep(0);
}catch(err){
setError((err as Error).message);
}
}, [script, tensionBefore, runStep]);

const playedFraction=useCallback(() => {
const done=script.steps
.slice(0, stepIndexRef.current)
.reduce((total, step) => total + step.seconds, 0);
return Math.min(1, done / script.totalSeconds);
}, [script]);

const stopEarly=useCallback(() => {
if(timer.current) clearTimeout(timer.current);
narrator.current?.stop();
setPhase("after");
}, []);

const save=useCallback(async () => {
if(timer.current) clearTimeout(timer.current);
narrator.current?.stop();
const id=sessionId.current;
if(!id){
router.back();
return;
}
const fraction=playedFraction();
try {
await finishSession(id, fraction, fraction >= 0.9, tensionAfter);
}catch(err){
setError((err as Error).message);
return;
}
setPhase("done");
}, [playedFraction, tensionAfter]);

if(error){
return (
<View style={styles.center}>
<Text style={styles.error}>{error}</Text>
<Pressable style={styles.primary} onPress={() => router.back()}>
<Text style={styles.primaryText}>Close</Text>
</Pressable>
</View>
);
}

if(phase === "before"){
return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<Text style={styles.title} maxFontSizeMultiplier={2}>
How tense do you feel right now?
</Text>
<Text style={styles.subtitle} maxFontSizeMultiplier={2}>
0 is completely loose, 10 is as tight as you get.
</Text>
<TensionScale value={tensionBefore} onChange={setTensionBefore} label="Tension now" />
<Text style={styles.note}>{SCREEN_LOCK_NOTE}</Text>
<Pressable
style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
onPress={begin}
accessibilityRole="button"
accessibilityLabel={`Start the ${script.name} session`}
>
<Text style={styles.primaryText} maxFontSizeMultiplier={1.8}>
Start {script.name.toLowerCase()}
</Text>
</Pressable>
<Pressable
style={styles.quiet}
onPress={() => router.back()}
accessibilityRole="button"
accessibilityLabel="Go back without starting"
>
<Text style={styles.quietText}>Not now</Text>
</Pressable>
</ScrollView>
);
}

if(phase === "running"){
const step=script.steps[stepIndex];
const elapsed=script.steps.slice(0, stepIndex).reduce((n, s) => n + s.seconds, 0);
const progress=Math.round((elapsed / script.totalSeconds) * 100);
return (
<View style={styles.runningRoot}>
{step?.group ? (
<Text style={styles.group} maxFontSizeMultiplier={1.6}>
{step.group}
</Text>
) : null}
<Text style={styles.say} maxFontSizeMultiplier={1.8}>
{step?.say ?? ""}
</Text>
{step?.tensingOptional ? (
<Text style={styles.optionalNote} maxFontSizeMultiplier={1.8}>
Tensing is optional here.
</Text>
) : null}

<View style={styles.progressTrack} accessibilityLabel={`${progress} percent through`}>
<View style={[styles.progressFill, { width: `${progress}%` }]} />
</View>

<Pressable
style={styles.quiet}
onPress={stopEarly}
accessibilityRole="button"
accessibilityLabel="Stop the session here"
>
<Text style={styles.quietText}>Stop here</Text>
</Pressable>
</View>
);
}

if(phase === "after"){
return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<Text style={styles.title} maxFontSizeMultiplier={2}>
And now?
</Text>
<Text style={styles.subtitle} maxFontSizeMultiplier={2}>
Same scale. Whatever you put is fine.
</Text>
<TensionScale value={tensionAfter} onChange={setTensionAfter} label="Tension after" />
<Pressable
style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
onPress={save}
accessibilityRole="button"
accessibilityLabel="Save this session"
>
<Text style={styles.primaryText} maxFontSizeMultiplier={1.8}>
Done
</Text>
</Pressable>
</ScrollView>
);
}

const drop=tensionDrop(tensionBefore, tensionAfter);
return (
<View style={styles.center}>
<Text style={styles.title} maxFontSizeMultiplier={2}>
{describeTensionDrop(drop) || "Session saved."}
</Text>
<Pressable
style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
onPress={() => router.back()}
accessibilityRole="button"
accessibilityLabel="Close"
>
<Text style={styles.primaryText} maxFontSizeMultiplier={1.8}>
Close
</Text>
</Pressable>
</View>
);
}

function TensionScale({
value,
onChange,
label,
}: {
value: number | null;
onChange: (value: number) => void;
label: string;
}){
return (
<View style={styles.scale} accessibilityRole="radiogroup">
{Array.from({ length: 11 }, (_, n) => {
const sel=value === n;
return (
<Pressable
key={n}
onPress={() => {
void Haptics.selectionAsync();
onChange(n);
}}
style={[styles.scaleDot, sel && styles.scaleDotSelected]}
accessibilityRole="radio"
accessibilityState={{ selected: sel }}
accessibilityLabel={`${label}, ${n} of 10`}
>
<Text
style={[styles.scaleText, sel && styles.scaleTextSelected]}
maxFontSizeMultiplier={1.4}
>
{n}
</Text>
</Pressable>
);
})}
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { padding: space.xl, gap: space.lg, paddingBottom: space.xxl },
center: {
flex: 1,
backgroundColor: colors.canvas,
alignItems: "center",
justifyContent: "center",
padding: space.xl,
gap: space.xl,
},
pressed: { opacity: 0.7 },

title: { color: colors.text, fontSize: typeScale.title, textAlign: "center" },
subtitle: { color: colors.textMuted, fontSize: typeScale.body, textAlign: "center" },
note: { color: colors.textFaint, fontSize: typeScale.caption, textAlign: "center" },
error: { color: colors.danger, fontSize: typeScale.body, textAlign: "center" },

scale: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, justifyContent: "center" },
scaleDot: {
width: touch.comfortable,
height: touch.comfortable,
borderRadius: touch.comfortable / 2,
alignItems: "center",
justifyContent: "center",
backgroundColor: colors.surface,
},
scaleDotSelected: { backgroundColor: colors.accent },
scaleText: { color: colors.textMuted, fontSize: typeScale.body },
scaleTextSelected: { color: colors.accentText },

primary: {
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.accent,
paddingHorizontal: space.xl,
},
primaryText: { color: colors.accentText, fontSize: typeScale.heading },
quiet: { alignSelf: "center", padding: space.lg, minHeight: touch.min, justifyContent: "center" },
quietText: { color: colors.textFaint, fontSize: typeScale.label },

runningRoot: {
flex: 1,
backgroundColor: "#06060a",
padding: space.xl,
justifyContent: "center",
gap: space.xl,
},
group: { color: "#55555f", fontSize: typeScale.label, textAlign: "center" },
say: { color: "#9d9daa", fontSize: typeScale.title, textAlign: "center", lineHeight: 34 },
optionalNote: { color: "#55555f", fontSize: typeScale.caption, textAlign: "center" },
progressTrack: {
height: 3,
borderRadius: radius.pill,
backgroundColor: "#16161c",
overflow: "hidden",
},
progressFill: { height: 3, backgroundColor: "#2e2e3c" },
});
