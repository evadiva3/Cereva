
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { runEngine } from "../../packages/engine/src/engine";
import { explainAll, REQUIRED_CAVEATS } from "../../packages/engine/src/explain";
import { describeProgress, engineProgress } from "../../packages/engine/src/progress";
import type { EngineOutput } from "../../packages/engine/src/types";
import { buildEngineInput, saveEngineRun } from "@/db/engineAdapter";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

export default function InsightsScreen(){
const [output, setOutput]=useState<EngineOutput | null>(null);
const [spanDays, setSpanDays]=useState(0);
const [error, setError]=useState<string | null>(null);
const [showAll, setShowAll]=useState(false);

const load=useCallback(() => {
setError(null);
buildEngineInput()
.then((days) => {
const res=runEngine(days);
setOutput(res);
setSpanDays(days.length);
if(res.windowStart && res.windowEnd){
void saveEngineRun(
res.windowStart,
res.windowEnd,
res.engineVersion,
res,
).catch(() => {});
}
})
.catch((err: Error) => setError(err.message));
}, []);

useEffect(load, [load]);

if(error){
return (
<View style={styles.center}>
<Text style={styles.error}>{error}</Text>
</View>
);
}

if(!output){
return (
<View style={styles.center}>
<ActivityIndicator color={colors.accent} />
</View>
);
}

const progress=engineProgress(output, spanDays);
const explained=explainAll(output);
const ptext=describeProgress(progress);

return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<Text style={styles.headline} maxFontSizeMultiplier={2}>
{explained.headline}
</Text>

{!progress.reporting ? (
<View style={styles.progressCard}>
<Text style={styles.progressText} maxFontSizeMultiplier={2}>
{ptext}
</Text>

<ProgressBar
label="Logged days"
have={progress.loggedDays.have}
need={progress.loggedDays.need}
/>
<ProgressBar
label="Attack starts"
have={progress.onsets.have}
need={progress.onsets.need}
/>

<Text style={styles.progressNote} maxFontSizeMultiplier={2}>
Both have to be met before any single factor is looked at. Attack
starts counts days an attack began, not days you had one.
</Text>
</View>
) : null}

{explained.findings.length > 0 ? (
<>
<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Stood out
</Text>
{explained.findings.map((text, i) => (
<View key={i} style={styles.findingCard}>
<Text style={styles.findingText} maxFontSizeMultiplier={2}>
{text}
</Text>
</View>
))}
</>
) : null}

{explained.noClearLink.length > 0 ? (
<>
<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Looked at, nothing clear
</Text>
{explained.noClearLink.map((text, i) => (
<Text key={i} style={styles.plainLine} maxFontSizeMultiplier={2}>
{text}
</Text>
))}
</>
) : null}

<Pressable
style={styles.toggle}
onPress={() => setShowAll((v) => !v)}
accessibilityRole="button"
accessibilityLabel={
showAll
? "Hide the factors without enough data"
: `Show the ${explained.notEnough.length} factors without enough data`
}
>
<Text style={styles.toggleText} maxFontSizeMultiplier={2}>
{showAll ? "Hide" : "Show"} the {explained.notEnough.length} without enough data
</Text>
</Pressable>

{showAll
? explained.notEnough.map((text, i) => (
<Text key={i} style={styles.mutedLine} maxFontSizeMultiplier={2}>
{text}
</Text>
))
: null}

<View style={styles.caveats}>
{(explained.caveats.length > 0 ? explained.caveats : [...REQUIRED_CAVEATS]).map(
(caveat, i) => (
<Text key={i} style={styles.caveat} maxFontSizeMultiplier={2}>
{caveat}
</Text>
),
)}
</View>

<Text style={styles.footnote}>
Based on {output.loggedDays} logged days and {output.onsets} attack
starts. Nothing here left your phone.
</Text>
</ScrollView>
);
}

function ProgressBar({ label, have, need }: { label: string; have: number; need: number }){
const fraction=need > 0 ? Math.min(1, have / need) : 1;
const percent=Math.round(fraction * 100);
return (
<View
style={styles.barRow}
accessible
accessibilityLabel={`${label}, ${have} of ${need}`}
accessibilityValue={{ min: 0, max: need, now: have }}
>
<View style={styles.barLabels}>
<Text style={styles.barLabel} maxFontSizeMultiplier={1.8}>
{label}
</Text>
<Text style={styles.barCount} maxFontSizeMultiplier={1.8}>
{have} of {need}
</Text>
</View>
<View style={styles.barTrack}>
<View style={[styles.barFill, { width: `${percent}%` }]} />
</View>
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
error: { color: colors.danger, fontSize: typeScale.body, padding: space.xl, textAlign: "center" },

headline: { color: colors.text, fontSize: typeScale.title, lineHeight: 30 },

progressCard: {
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surface,
gap: space.md,
},
progressText: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: 24 },
progressNote: { color: colors.textFaint, fontSize: typeScale.caption },

barRow: { gap: space.xs },
barLabels: { flexDirection: "row", justifyContent: "space-between" },
barLabel: { color: colors.textMuted, fontSize: typeScale.caption },
barCount: { color: colors.text, fontSize: typeScale.caption },
barTrack: { height: 6, borderRadius: radius.pill, backgroundColor: colors.line, overflow: "hidden" },
barFill: { height: 6, backgroundColor: colors.accentDim },

sectionHeading: { color: colors.textMuted, fontSize: typeScale.label, marginTop: space.lg },
findingCard: {
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surface,
borderLeftWidth: 3,
borderLeftColor: colors.accent,
},
findingText: { color: colors.text, fontSize: typeScale.body, lineHeight: 24 },
plainLine: { color: colors.textMuted, fontSize: typeScale.caption, lineHeight: 20 },
mutedLine: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 20 },

toggle: {
minHeight: touch.min,
justifyContent: "center",
marginTop: space.md,
},
toggleText: { color: colors.accent, fontSize: typeScale.label },

caveats: {
gap: space.sm,
marginTop: space.lg,
padding: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surface,
},
caveat: { color: colors.textMuted, fontSize: typeScale.caption, lineHeight: 20 },

footnote: {
color: colors.textFaint,
fontSize: typeScale.caption,
textAlign: "center",
marginTop: space.lg,
},
});
