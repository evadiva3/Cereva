
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import {
ExpoSpeechRecognitionModule,
useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import {
addReading,
markContinuous,
openAttack,
startAttack,
updateAttack,
type Attack,
} from "@/db/attacks";
import { quickMark } from "@/db/dayLogs";
import { extractReport, type Extracted } from "@/voice/extract";
import { QUESTIONS } from "@/voice/questions";
import { Mascot } from "@/mascot/Mascot";
import { today } from "@/dates";
import { SAFETY_NOTE, colors, radius, space, touch, type as typeScale } from "@/theme";

type Stage="starting" | "listening" | "report" | "blocked" | "finishing";

const SEVERITY_WORD: Record<string, string>={
mild: "Mild",
moderate: "Rough",
severe: "Severe",
};

export default function VoiceScreen(){
const [stage, setStage]=useState<Stage>("starting");
const [text, setText]=useState("");
const [attack, setAttack]=useState<Attack | null>(null);
const [problem, setProblem]=useState<string | null>(null);
const [step, setStep]=useState(0);
const [report, setReport]=useState<Extracted | null>(null);
const transcript=useRef("");
const interim=useRef("");
const finishing=useRef(false);
const finishRecognition=useRef<(() => void) | null>(null);
const mounted=useRef(true);

const say=useCallback((line: string) => {
try {
Speech.stop();
Speech.speak(line, { rate: 0.7, pitch: 0.9 });
} catch {}
}, []);

useEffect(() => {
let alive=true;
mounted.current=true;
(async () => {
const open=await openAttack().catch(() => null);
const a=open ?? (await startAttack().catch(() => null));
if(!alive) return;
setAttack(a);
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

if(!ExpoSpeechRecognitionModule.isRecognitionAvailable()){
setProblem("Speech is not available on this device. The attack is logged either way.");
setStage("blocked");
return;
}
if(!ExpoSpeechRecognitionModule.supportsOnDeviceRecognition()){
setProblem(
"This phone cannot turn speech into text without sending the audio to " +
"Apple, so Cereva will not listen. Nothing left your phone. The attack " +
"is logged, and you can type the details whenever you want.",
);
setStage("blocked");
return;
}
const perm=await ExpoSpeechRecognitionModule.requestPermissionsAsync().catch(() => null);
if(!alive) return;
if(!perm?.granted){
setProblem("Cereva needs the microphone to listen. The attack is logged either way.");
setStage("blocked");
return;
}
ExpoSpeechRecognitionModule.start({
lang: "en-US",
interimResults: true,
continuous: true,
addsPunctuation: true,
requiresOnDeviceRecognition: true,
});
setStage("listening");
say(QUESTIONS[0]!.spoken);
})();
return () => {
alive=false;
mounted.current=false;
finishRecognition.current?.();
try { ExpoSpeechRecognitionModule.abort(); } catch {}
try { Speech.stop(); } catch {}
};
}, [say]);

useSpeechRecognitionEvent("result", (event) => {
const said=event.results?.[0]?.transcript ?? "";
if(!said) return;
if(event.isFinal){
transcript.current=`${transcript.current} ${said}`.trim();
interim.current="";
}else{
interim.current=said;
}
setText(`${transcript.current} ${interim.current}`.trim());
});

useSpeechRecognitionEvent("end", () => finishRecognition.current?.());

useSpeechRecognitionEvent("error", () => {
if(finishing.current){ finishRecognition.current?.(); return; }
setProblem("That did not come through. The attack is logged either way.");
setStage("blocked");
});

const ask=useCallback(() => {
const next=step + 1;
if(next >= QUESTIONS.length) return;
void Haptics.selectionAsync();
setStep(next);
say(QUESTIONS[next]!.spoken);
}, [step, say]);

const finish=useCallback(async () => {
if(finishing.current) return;
finishing.current=true;
setStage("finishing");
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
try { Speech.stop(); } catch {}
await new Promise<void>(resolve => {
const timer=setTimeout(done,1500);
function done(){
clearTimeout(timer);
finishRecognition.current=null;
resolve();
}
finishRecognition.current=done;
try { ExpoSpeechRecognitionModule.stop(); } catch { done(); }
});
if(!mounted.current) return;
const said=`${transcript.current} ${interim.current}`.trim();
const found=extractReport(said);
setReport(found);

if(attack){
if(said) await updateAttack(attack.id, { note: said }).catch(() => {});
await addReading(attack.id, found.severity, said || null).catch(() => {});
if(found.aura) await updateAttack(attack.id, { aura: found.aura }).catch(() => {});
if(found.meds) await updateAttack(attack.id, { meds: true }).catch(() => {});
if(found.continuous) await markContinuous(attack.id, true).catch(() => {});
}
if(found.severity){
await quickMark(today(), found.severity).catch(() => {});
}
if(found.redFlags.length > 0){
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
setStage("report");
}, [attack]);

const leave=useCallback(() => {
try { ExpoSpeechRecognitionModule.abort(); } catch {}
try { Speech.stop(); } catch {}
router.back();
}, []);

const live=text;
const question=QUESTIONS[step]!;

if(stage === "report" && report){
const urgent=report.redFlags.length > 0;
return (
<ScrollView style={styles.root} contentContainerStyle={styles.reportContent}>
{urgent ? (
<View style={styles.urgent}>
<View style={styles.urgentHead}>
<Ionicons name="warning" size={24} color={colors.danger} />
<Text style={styles.urgentTitle} maxFontSizeMultiplier={1.6}>
Please get this looked at now
</Text>
</View>
{report.redFlags.map((f) => (
<Text key={f.id} style={styles.urgentLine} maxFontSizeMultiplier={1.6}>
You said "{f.heard}". {f.why}
</Text>
))}
<Text style={styles.urgentLine} maxFontSizeMultiplier={1.6}>
{SAFETY_NOTE}
</Text>
<Text style={styles.urgentNote} maxFontSizeMultiplier={1.6}>
Cereva cannot tell what is happening and is not saying you are fine.
It is logged, and it will still be there later.
</Text>
</View>
) : null}

<Text style={styles.reportTitle} maxFontSizeMultiplier={1.8}>
Here is what I put down
</Text>

<View style={styles.rows}>
<Row label="Pain" value={report.severity ? SEVERITY_WORD[report.severity]! : report.painMentioned ? "Pain mentioned; level unclear" : "Level not identified"} />
<Row label="Still going" value={report.continuous ? "yes" : "not said"} />
<Row label="Aura" value={report.aura === "yes" ? "yes" : "not said"} />
<Row label="Took something" value={report.meds ? "yes" : "not said"} />
<Row
label="Also"
value={report.symptoms.length > 0 ? report.symptoms.join(", ") : "nothing else"}
/>
</View>

{report.heard.length > 0 ? (
<>
<Text style={styles.heardTitle} maxFontSizeMultiplier={1.6}>
From your words
</Text>
{report.heard.map((h, i) => (
<Text key={i} style={styles.heardLine} maxFontSizeMultiplier={1.6}>
"{h.phrase}" {"→"} {h.meaning}
</Text>
))}
</>
) : null}

{!urgent && attack && <Pressable style={styles.secondary} onPress={()=>router.push({pathname:"/describe",params:{attackId:attack.id}})} accessibilityRole="button" accessibilityLabel="Create an aura configuration from this recording"><Text style={styles.secondaryText}>Create aura from this recording</Text></Pressable>}
<Text style={styles.disclaimer} maxFontSizeMultiplier={1.6}>
This is only what Cereva matched in what you said. It is a diary entry,
not an assessment. Edit it any time.
</Text>

<Pressable
style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
onPress={leave}
accessibilityRole="button"
accessibilityLabel="Done, close and rest"
>
<Text style={styles.primaryText} maxFontSizeMultiplier={1.6}>
Rest now
</Text>
</Pressable>
</ScrollView>
);
}

return (
<View style={styles.root}>
<Pressable
style={styles.close}
onPress={leave}
accessibilityRole="button"
accessibilityLabel="Close"
>
<Ionicons name="close" size={26} color={colors.textMuted} />
</Pressable>

<View style={styles.center}>
<Mascot mood="with_you" size={104} label="Cereva is listening" />

{stage === "finishing" ? (
<>
<Text style={styles.title} maxFontSizeMultiplier={1.8}>Saving what you said</Text>
<ActivityIndicator color={colors.accent} />
</>
) : null}

{stage === "starting" ? (
<>
<Text style={styles.title} maxFontSizeMultiplier={1.8}>
Recording
</Text>
<ActivityIndicator color={colors.accent} />
</>
) : null}

{stage === "listening" ? (
<>
<Text style={styles.title} maxFontSizeMultiplier={1.8}>
{question.text}
</Text>
<Text style={styles.prompt} maxFontSizeMultiplier={1.8}>
Answer it, or just talk.
</Text>
<ScrollView style={styles.transcriptBox} contentContainerStyle={styles.transcriptInner}>
<Text style={styles.transcript} maxFontSizeMultiplier={1.8}>
{live || "..."}
</Text>
</ScrollView>
</>
) : null}

{stage === "blocked" ? (
<>
<Text style={styles.title} maxFontSizeMultiplier={1.8}>
Attack recorded
</Text>
<Text style={styles.prompt} maxFontSizeMultiplier={1.8}>
{problem}
</Text>
</>
) : null}
</View>

<View style={styles.actions}>
{stage === "listening" ? (
<>
<View style={styles.dots}>
{QUESTIONS.map((q, i) => (
<View key={q.id} style={[styles.dot, i <= step && styles.dotOn]} />
))}
</View>
{step < QUESTIONS.length - 1 ? (
<Pressable
style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
onPress={ask}
accessibilityRole="button"
accessibilityLabel="Next question"
>
<Text style={styles.secondaryText} maxFontSizeMultiplier={1.6}>
Next question
</Text>
</Pressable>
) : null}
<Pressable
style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
onPress={finish}
accessibilityRole="button"
accessibilityLabel="Stop and write it down"
>
<Ionicons name="checkmark-circle" size={24} color={colors.accentText} />
<Text style={styles.primaryText} maxFontSizeMultiplier={1.6}>
That is everything
</Text>
</Pressable>
</>
) : null}

{stage === "blocked" ? (
<Pressable
style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
onPress={leave}
accessibilityRole="button"
accessibilityLabel="Close and rest"
>
<Text style={styles.primaryText} maxFontSizeMultiplier={1.6}>
Rest now
</Text>
</Pressable>
) : null}
</View>
</View>
);
}

function Row({ label, value }: { label: string; value: string }){
return (
<View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
<Text style={styles.rowLabel} maxFontSizeMultiplier={1.6}>
{label}
</Text>
<Text style={styles.rowValue} maxFontSizeMultiplier={1.6}>
{value}
</Text>
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas, padding: space.lg },
close: { alignSelf: "flex-end", minWidth: touch.min, minHeight: touch.min, alignItems: "flex-end", justifyContent: "center" },
center: { flex: 1, alignItems: "center", justifyContent: "center", gap: space.md },
title: { color: colors.text, fontSize: typeScale.title, textAlign: "center" },
prompt: { color: colors.textMuted, fontSize: typeScale.body, textAlign: "center", lineHeight: 24, paddingHorizontal: space.md },
transcriptBox: { maxHeight: 190, alignSelf: "stretch" },
transcriptInner: { padding: space.md },
transcript: { color: colors.text, fontSize: typeScale.heading, lineHeight: 28, textAlign: "center" },

actions: { gap: space.md, paddingBottom: space.xl },
dots: { flexDirection: "row", justifyContent: "center", gap: space.xs },
dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
dotOn: { backgroundColor: colors.accentDim },

primary: {
minHeight: touch.comfortable,
flexDirection: "row",
alignItems: "center",
justifyContent: "center",
gap: space.sm,
borderRadius: radius.lg,
backgroundColor: colors.accent,
},
primaryText: { color: colors.accentText, fontSize: typeScale.heading },
secondary: {
minHeight: touch.min,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.lg,
backgroundColor: colors.surface,
},
secondaryText: { color: colors.accent, fontSize: typeScale.body },

reportContent: { paddingBottom: space.xxl, gap: space.md },
reportTitle: { color: colors.text, fontSize: typeScale.title, marginTop: space.lg },
rows: { borderRadius: radius.lg, backgroundColor: colors.surface, overflow: "hidden" },
row: {
flexDirection: "row",
justifyContent: "space-between",
alignItems: "center",
paddingVertical: space.md,
paddingHorizontal: space.lg,
borderBottomWidth: 1,
borderBottomColor: colors.canvas,
},
rowLabel: { color: colors.textMuted, fontSize: typeScale.body },
rowValue: { color: colors.text, fontSize: typeScale.body },

heardTitle: { color: colors.textMuted, fontSize: typeScale.label, marginTop: space.sm },
heardLine: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 20 },
disclaimer: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 19, marginTop: space.sm },

urgent: {
padding: space.lg,
borderRadius: radius.lg,
borderWidth: 1,
borderColor: colors.danger,
backgroundColor: colors.surface,
gap: space.sm,
marginTop: space.lg,
},
urgentHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
urgentTitle: { color: colors.danger, fontSize: typeScale.heading, flex: 1 },
urgentLine: { color: colors.text, fontSize: typeScale.body, lineHeight: 23 },
urgentNote: { color: colors.textMuted, fontSize: typeScale.caption, lineHeight: 19 },

pressed: { opacity: 0.7 },
});
