
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { dateLabel, loggableDates, today } from "@/dates";
import {
getDayLog,
saveDayLog,
type DayLogInput,
type Headache,
type Stress,
} from "@/db/dayLogs";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

const HEADACHE_OPTIONS: { value: Headache; label: string }[]=[
{ value: "none", label: "None" },
{ value: "mild", label: "Mild" },
{ value: "moderate", label: "Moderate" },
{ value: "severe", label: "Severe" },
];

const STRESS_OPTIONS: { value: Stress | null; label: string }[]=[
{ value: null, label: "Skip" },
{ value: "low", label: "Low" },
{ value: "medium", label: "Medium" },
{ value: "high", label: "High" },
];

function emptyLog(date: string): DayLogInput {
return {
localDate: date,
headache: "none",
attackDay: false,
acuteMed: false,
alcohol: false,
caffeineChange: false,
skippedMeal: false,
stress: null,
};
}

export default function CheckInScreen(){
const [date, setDate]=useState(today());
const [log, setLog]=useState<DayLogInput>(() => emptyLog(today()));
const [existing, setExisting]=useState(false);
const [busy, setBusy]=useState(false);
const [error, setError]=useState<string | null>(null);

useEffect(() => {
let cancelled=false;
getDayLog(date)
.then((found) => {
if(cancelled) return;
setExisting(!!found);
setLog(
found
? {
localDate: found.localDate,
headache: found.headache,
attackDay: found.attackDay,
acuteMed: found.acuteMed,
alcohol: found.alcohol,
caffeineChange: found.caffeineChange,
skippedMeal: found.skippedMeal,
stress: found.stress,
}
: emptyLog(date),
);
})
.catch(() => {
if(!cancelled) setLog(emptyLog(date));
});
return () => {
cancelled=true;
};
}, [date]);

const set=useCallback(<K extends keyof DayLogInput>(key: K, value: DayLogInput[K]) => {
void Haptics.selectionAsync();
setLog((prev) => ({ ...prev, [key]: value }));
}, []);

const save=useCallback(async () => {
setBusy(true);
setError(null);
try {
await saveDayLog(log);
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
router.back();
}catch(err){
setError((err as Error).message);
}finally {
setBusy(false);
}
}, [log]);

const dates=loggableDates();

return (
<View style={styles.root}>
<ScrollView contentContainerStyle={styles.content}>
<View style={styles.dayRow}>
{dates.map((d) => (
<Pressable
key={d}
onPress={() => setDate(d)}
style={[styles.dayChip, d === date && styles.dayChipSelected]}
accessibilityRole="radio"
accessibilityState={{ selected: d === date }}
accessibilityLabel={`Log for ${dateLabel(d)}`}
>
<Text
style={[styles.dayChipText, d === date && styles.dayChipTextSelected]}
maxFontSizeMultiplier={1.8}
>
{dateLabel(d)}
</Text>
</Pressable>
))}
</View>

{existing ? (
<Text style={styles.note} maxFontSizeMultiplier={2}>
You already logged this day. Changing anything updates it.
</Text>
) : null}

<Question label="Headache today">
<Segmented
options={HEADACHE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
value={log.headache}
onChange={(v) => set("headache", v as Headache)}
groupLabel="Headache today"
/>
</Question>

<Toggle
label="Migraine attack day"
hint="A day an attack started or continued."
value={log.attackDay}
onChange={(v) => set("attackDay", v)}
/>

<Toggle
label="Took acute medication"
value={log.acuteMed}
onChange={(v) => set("acuteMed", v)}
/>

<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Anything different yesterday or today
</Text>

<Toggle label="Alcohol" value={log.alcohol} onChange={(v) => set("alcohol", v)} />
<Toggle
label="More or less caffeine than usual"
value={log.caffeineChange}
onChange={(v) => set("caffeineChange", v)}
/>
<Toggle
label="Skipped a meal"
value={log.skippedMeal}
onChange={(v) => set("skippedMeal", v)}
/>

<Question label="Stress" optional>
<Segmented
options={STRESS_OPTIONS.map((o) => ({
value: o.value ?? "__skip",
label: o.label,
}))}
value={log.stress ?? "__skip"}
onChange={(v) => set("stress", v === "__skip" ? null : (v as Stress))}
groupLabel="Stress"
/>
</Question>

{error ? <Text style={styles.error}>{error}</Text> : null}

<Text style={styles.footnote}>
This stays on your phone. Nothing here is sent anywhere.
</Text>
</ScrollView>

<View style={styles.footer}>
<Pressable
style={({ pressed }) => [styles.save, pressed && styles.pressed, busy && styles.disabled]}
disabled={busy}
onPress={save}
accessibilityRole="button"
accessibilityLabel={`Save check-in for ${dateLabel(date)}`}
>
<Text style={styles.saveText} maxFontSizeMultiplier={1.8}>
Save
</Text>
</Pressable>
</View>
</View>
);
}

function Question({
label,
optional,
children,
}: {
label: string;
optional?: boolean;
children: React.ReactNode;
}){
return (
<View style={styles.question}>
<Text style={styles.questionLabel} maxFontSizeMultiplier={2}>
{label}
{optional ? <Text style={styles.optional}>  optional</Text> : null}
</Text>
{children}
</View>
);
}

function Segmented({
options,
value,
onChange,
groupLabel,
}: {
options: { value: string; label: string }[];
value: string;
onChange: (value: string) => void;
groupLabel: string;
}){
return (
<View style={styles.segmented} accessibilityRole="radiogroup">
{options.map((option) => {
const selected=option.value === value;
return (
<Pressable
key={option.value}
onPress={() => onChange(option.value)}
style={[styles.segment, selected && styles.segmentSelected]}
accessibilityRole="radio"
accessibilityState={{ selected }}
accessibilityLabel={`${groupLabel}, ${option.label}`}
>
<Text
style={[styles.segmentText, selected && styles.segmentTextSelected]}
maxFontSizeMultiplier={1.6}
>
{option.label}
</Text>
</Pressable>
);
})}
</View>
);
}

function Toggle({
label,
hint,
value,
onChange,
}: {
label: string;
hint?: string;
value: boolean;
onChange: (value: boolean) => void;
}){
return (
<View style={styles.toggleRow}>
<View style={styles.toggleLabels}>
<Text style={styles.toggleLabel} maxFontSizeMultiplier={2}>
{label}
</Text>
{hint ? (
<Text style={styles.toggleHint} maxFontSizeMultiplier={2}>
{hint}
</Text>
) : null}
</View>
<Switch
value={value}
onValueChange={onChange}
accessibilityLabel={label}
trackColor={{ false: colors.line, true: colors.accentDim }}
thumbColor={value ? colors.accent : colors.textFaint}
ios_backgroundColor={colors.line}
/>
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { padding: space.lg, paddingBottom: space.xxl, gap: space.md },
pressed: { opacity: 0.7 },
disabled: { opacity: 0.4 },

dayRow: { flexDirection: "row", gap: space.sm },
dayChip: {
flex: 1,
minHeight: touch.min,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
},
dayChipSelected: { backgroundColor: colors.accentDim },
dayChipText: { color: colors.textMuted, fontSize: typeScale.label },
dayChipTextSelected: { color: colors.text },

note: { color: colors.textFaint, fontSize: typeScale.caption },
sectionHeading: {
color: colors.textMuted,
fontSize: typeScale.label,
marginTop: space.md,
},

question: { gap: space.sm },
questionLabel: { color: colors.text, fontSize: typeScale.body },
optional: { color: colors.textFaint, fontSize: typeScale.caption },

segmented: { flexDirection: "row", gap: space.sm },
segment: {
flex: 1,
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.surface,
paddingHorizontal: space.xs,
},
segmentSelected: { backgroundColor: colors.accentDim },
segmentText: { color: colors.textMuted, fontSize: typeScale.caption, textAlign: "center" },
segmentTextSelected: { color: colors.text },

toggleRow: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
minHeight: touch.comfortable,
},
toggleLabels: { flex: 1, gap: 2 },
toggleLabel: { color: colors.text, fontSize: typeScale.body },
toggleHint: { color: colors.textFaint, fontSize: typeScale.caption },

error: { color: colors.warn, fontSize: typeScale.label },
footnote: {
color: colors.textFaint,
fontSize: typeScale.caption,
textAlign: "center",
marginTop: space.lg,
},

footer: {
padding: space.md,
borderTopWidth: StyleSheet.hairlineWidth,
borderTopColor: colors.line,
},
save: {
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.accent,
},
saveText: { color: colors.accentText, fontSize: typeScale.heading },
});
