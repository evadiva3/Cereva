
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import {
applyReEntryChoice,
DEFAULT_SESSION_SECONDS,
LONG_SESSION_SECONDS,
LONG_SESSION_UNLOCK_AFTER,
type ReEntryChoice,
} from "../../packages/loosen/src/schedule";
import { loosenOverview, savePlan, type LoosenOverview } from "@/db/loosenSessions";
import { SCREEN_LOCK_NOTE } from "@/loosen/narrator";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

export default function LoosenScreen(){
const [overview, setOverview]=useState<LoosenOverview | null>(null);
const [cueDraft, setCueDraft]=useState("");
const [editingCue, setEditingCue]=useState(false);

const reload=useCallback(() => {
loosenOverview()
.then((next) => {
setOverview(next);
setCueDraft(next.plan.cue ?? "");
setEditingCue(!next.plan.cue);
})
.catch(() => setOverview(null));
}, []);

useEffect(reload, [reload]);
useFocusEffect(useCallback(() => reload(), [reload]));

const chooseReEntry=useCallback(
async (choice: ReEntryChoice) => {
if(!overview) return;
void Haptics.selectionAsync();
await savePlan(applyReEntryChoice(overview.plan, choice));
reload();
},
[overview, reload],
);

const saveCue=useCallback(async () => {
if(!overview) return;
void Haptics.selectionAsync();
await savePlan({ ...overview.plan, cue: cueDraft.trim() || null });
setEditingCue(false);
reload();
}, [overview, cueDraft, reload]);

if(!overview){
return (
<View style={styles.center}>
<Text style={styles.muted}>Loading</Text>
</View>
);
}

const { thisWeek, plan, reEntry, longUnlocked, completedShortSessions }=overview;

return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<View style={styles.weekCard}>
<Text style={styles.weekLabel} maxFontSizeMultiplier={2}>
{thisWeek.label}
</Text>
{thisWeek.note ? (
<Text style={styles.weekNote} maxFontSizeMultiplier={2}>
{thisWeek.note}
</Text>
) : null}
{thisWeek.outcome === "heavy" ? (
<Text style={styles.weekNote} maxFontSizeMultiplier={2}>
A heavy week. This one is not counted either way.
</Text>
) : null}
</View>

{reEntry.needed ? (
<View style={styles.reEntryCard}>
<Text style={styles.reEntryTitle} maxFontSizeMultiplier={2}>
Two quiet weeks
</Text>
<Text style={styles.reEntryBody} maxFontSizeMultiplier={2}>
That usually means the plan does not fit, not that you need to try
harder. Would any of these help?
</Text>
<ReEntryButton
label="Pick a different moment"
hint="Change what the session comes after."
onPress={() => {
void chooseReEntry("change_cue");
setEditingCue(true);
}}
/>
<ReEntryButton
label="Drop to one a week"
hint="For now. You can put it back whenever."
onPress={() => chooseReEntry("reduce_target")}
/>
<ReEntryButton
label="Leave it as it is"
hint="Nothing changes."
onPress={() => chooseReEntry("keep_plan")}
/>
</View>
) : null}

<View style={styles.cueCard}>
<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
When
</Text>
<Text style={styles.cueExplain} maxFontSizeMultiplier={2}>
Attaching this to something you already do every day works better
than picking a time. Finish the sentence.
</Text>
{editingCue ? (
<>
<View style={styles.cueRow}>
<Text style={styles.cuePrefix} maxFontSizeMultiplier={2}>
After
</Text>
<TextInput
style={styles.cueInput}
value={cueDraft}
onChangeText={setCueDraft}
placeholder="I put the kettle on"
placeholderTextColor={colors.textFaint}
accessibilityLabel="What this session comes after"
maxLength={80}
maxFontSizeMultiplier={2}
/>
</View>
<Pressable
style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}
onPress={saveCue}
accessibilityRole="button"
accessibilityLabel="Save this cue"
>
<Text style={styles.smallButtonText} maxFontSizeMultiplier={1.8}>
Save
</Text>
</Pressable>
</>
) : (
<Pressable
style={styles.cueDisplay}
onPress={() => setEditingCue(true)}
accessibilityRole="button"
accessibilityLabel={`Your cue is: after ${plan.cue}. Tap to change it.`}
>
<Text style={styles.cueText} maxFontSizeMultiplier={2}>
After {plan.cue}, my {Math.round(plan.sessionSeconds / 60)} minutes.
</Text>
<Text style={styles.cueChange}>Change</Text>
</Pressable>
)}
</View>

<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Start
</Text>

<SessionButton
label="Five minutes"
hint="Six muscle groups."
onPress={() =>
router.push({
pathname: "/loosen-player",
params: { seconds: String(DEFAULT_SESSION_SECONDS) },
})
}
/>

{longUnlocked ? (
<SessionButton
label="Fifteen minutes"
hint="Twelve groups, with longer pauses."
onPress={() =>
router.push({
pathname: "/loosen-player",
params: { seconds: String(LONG_SESSION_SECONDS) },
})
}
/>
) : (
<View style={styles.lockedCard}>
<Text style={styles.lockedText} maxFontSizeMultiplier={2}>
A fifteen minute version appears after{" "}
{LONG_SESSION_UNLOCK_AFTER - completedShortSessions} more short
{LONG_SESSION_UNLOCK_AFTER - completedShortSessions === 1
? " session"
: " sessions"}
.
</Text>
</View>
)}

<Text style={styles.footnote}>{SCREEN_LOCK_NOTE}</Text>
<Text style={styles.footnote}>
This is relaxation training. It is not a treatment and it is not a
substitute for anything your doctor has advised.
</Text>
</ScrollView>
);
}

function SessionButton({
label,
hint,
onPress,
}: {
label: string;
hint: string;
onPress: () => void;
}){
return (
<Pressable
style={({ pressed }) => [styles.sessionButton, pressed && styles.pressed]}
onPress={onPress}
accessibilityRole="button"
accessibilityLabel={`${label}. ${hint}`}
>
<Text style={styles.sessionLabel} maxFontSizeMultiplier={2}>
{label}
</Text>
<Text style={styles.sessionHint} maxFontSizeMultiplier={2}>
{hint}
</Text>
</Pressable>
);
}

function ReEntryButton({
label,
hint,
onPress,
}: {
label: string;
hint: string;
onPress: () => void;
}){
return (
<Pressable
style={({ pressed }) => [styles.reEntryButton, pressed && styles.pressed]}
onPress={onPress}
accessibilityRole="button"
accessibilityLabel={`${label}. ${hint}`}
>
<Text style={styles.reEntryLabel} maxFontSizeMultiplier={2}>
{label}
</Text>
<Text style={styles.reEntryHint} maxFontSizeMultiplier={2}>
{hint}
</Text>
</Pressable>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
muted: { color: colors.textMuted, fontSize: typeScale.body },
pressed: { opacity: 0.7 },

weekCard: { padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, gap: space.xs },
weekLabel: { color: colors.text, fontSize: typeScale.title },
weekNote: { color: colors.textMuted, fontSize: typeScale.caption },

reEntryCard: {
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surface,
borderLeftWidth: 3,
borderLeftColor: colors.accentDim,
gap: space.sm,
},
reEntryTitle: { color: colors.text, fontSize: typeScale.heading },
reEntryBody: { color: colors.textMuted, fontSize: typeScale.body, marginBottom: space.sm },
reEntryButton: {
minHeight: touch.comfortable,
justifyContent: "center",
paddingHorizontal: space.lg,
paddingVertical: space.md,
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
},
reEntryLabel: { color: colors.text, fontSize: typeScale.body },
reEntryHint: { color: colors.textFaint, fontSize: typeScale.caption, marginTop: 2 },

cueCard: { gap: space.sm },
sectionHeading: { color: colors.textMuted, fontSize: typeScale.label, marginTop: space.md },
cueExplain: { color: colors.textFaint, fontSize: typeScale.caption },
cueRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
cuePrefix: { color: colors.textMuted, fontSize: typeScale.body },
cueInput: {
flex: 1,
minHeight: touch.min,
borderRadius: radius.md,
backgroundColor: colors.surface,
borderWidth: 1,
borderColor: colors.line,
paddingHorizontal: space.md,
color: colors.text,
fontSize: typeScale.body,
},
cueDisplay: {
minHeight: touch.comfortable,
justifyContent: "center",
padding: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surface,
},
cueText: { color: colors.text, fontSize: typeScale.body },
cueChange: { color: colors.accent, fontSize: typeScale.caption, marginTop: 2 },

smallButton: {
alignSelf: "flex-start",
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
},
smallButtonText: { color: colors.text, fontSize: typeScale.label },

sessionButton: {
minHeight: 80,
justifyContent: "center",
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surfaceRaised,
},
sessionLabel: { color: colors.text, fontSize: typeScale.heading },
sessionHint: { color: colors.textFaint, fontSize: typeScale.caption, marginTop: 2 },

lockedCard: { padding: space.lg, borderRadius: radius.md, backgroundColor: colors.surface },
lockedText: { color: colors.textFaint, fontSize: typeScale.caption },

footnote: {
color: colors.textFaint,
fontSize: typeScale.caption,
textAlign: "center",
marginTop: space.md,
},
});
