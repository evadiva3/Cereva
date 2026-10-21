
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { getAiConsent, setAiConsent, type AiConsentState } from "@/ai/consent";
import { isAiConfigured } from "@/ai/client";
import { dataSummary, deleteEverything, exportCsv, exportJson, shareExport } from "@/export";
import { describeHealthStatus, isHealthAvailable, requestHealthAccess } from "@/health/healthkit";
import { syncWeather } from "@/weather/openMeteo";
import { SAFETY_NOTE, colors, radius, space, touch, type as typeScale } from "@/theme";

export default function SettingsScreen(){
const [consent, setConsent]=useState<AiConsentState | null>(null);
const [counts, setCounts]=useState<Record<string, number> | null>(null);
const [healthAvailable, setHealthAvailable]=useState<boolean | null>(null);
const [busy, setBusy]=useState<string | null>(null);
const [notice, setNotice]=useState<string | null>(null);

const reload=useCallback(() => {
getAiConsent().then(setConsent).catch(() => setConsent(null));
dataSummary().then(setCounts).catch(() => setCounts(null));
isHealthAvailable().then(setHealthAvailable).catch(() => setHealthAvailable(false));
}, []);

useEffect(reload, [reload]);

const toggleConsent=useCallback(
async (value: boolean) => {
void Haptics.selectionAsync();
const next=await setAiConsent(value);
setConsent(next);
setNotice(
value
? "Describing in words is on."
: "Describing in words is off. Nothing will be sent anywhere.",
);
},
[],
);

const doExport=useCallback(async (kind: "json" | "csv") => {
setBusy(kind);
setNotice(null);
try {
const result=kind === "json" ? await exportJson() : await exportCsv();
const total=Object.values(result.counts).reduce((a, b) => a + b, 0);
await shareExport(result.uri);
setNotice(`Exported ${total} rows.`);
}catch(err){
setNotice(`Could not export: ${(err as Error).message}`);
}finally {
setBusy(null);
}
}, []);

const confirmDelete=useCallback(() => {
const total=counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
Alert.alert(
"Delete everything",
`This removes all ${total} rows and every saved aura image from this ` +
`phone. It cannot be undone, and there is no copy anywhere else.`,
[
{ text: "Keep my data", style: "cancel" },
{
text: "Delete everything",
style: "destructive",
onPress: () => {
void (async () => {
setBusy("delete");
try {
await deleteEverything();
setNotice("Everything has been deleted.");
reload();
}catch(err){
setNotice(`Could not delete: ${(err as Error).message}`);
}finally {
setBusy(null);
}
})();
},
},
],
);
}, [counts, reload]);

const totalRows=counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;

return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<View style={styles.safetyCard}>
<Text style={styles.safetyHeading} maxFontSizeMultiplier={2}>
If something is new or different
</Text>
<Text style={styles.safetyBody} maxFontSizeMultiplier={2}>
{SAFETY_NOTE}
</Text>
</View>

{notice ? (
<Pressable
style={styles.notice}
onPress={() => setNotice(null)}
accessibilityRole="button"
accessibilityLabel={`${notice}. Tap to dismiss.`}
>
<Text style={styles.noticeText} maxFontSizeMultiplier={2}>
{notice}
</Text>
</Pressable>
) : null}

<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Describing your aura in words
</Text>
<View style={styles.row}>
<View style={styles.rowLabels}>
<Text style={styles.rowLabel} maxFontSizeMultiplier={2}>
Send descriptions to the AI server
</Text>
<Text style={styles.rowHint} maxFontSizeMultiplier={2}>
{consent?.granted
? "Only the words you type are sent. Nothing else, ever."
: "Off. Building an aura by hand works fully without this."}
</Text>
{consent?.grantedAt ? (
<Text style={styles.rowHint} maxFontSizeMultiplier={2}>
Turned on {new Date(consent.grantedAt).toLocaleDateString()}.
</Text>
) : null}
</View>
<Switch
value={!!consent?.granted}
onValueChange={toggleConsent}
disabled={!isAiConfigured() && !consent?.granted}
accessibilityLabel="Send aura descriptions to the AI server"
trackColor={{ false: colors.line, true: colors.accentDim }}
thumbColor={consent?.granted ? colors.accent : colors.textFaint}
ios_backgroundColor={colors.line}
/>
</View>

<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Passive data
</Text>
<ActionRow
label="Apple Health"
hint={
healthAvailable === false
? "Not available on this device."
: describeHealthStatus(null) === ""
? ""
: "Sleep, steps, and cycle if you log it. Read only, never written."
}
actionLabel="Allow"
disabled={healthAvailable === false || busy !== null}
onPress={async () => {
setBusy("health");
const asked=await requestHealthAccess();
setBusy(null);
setNotice(
asked
? "Health was asked. Apple does not tell apps what was allowed, so this will show data when there is some."
: "Health could not be opened on this device.",
);
}}
/>
<ActionRow
label="Weather"
hint="Air pressure and temperature, from a rounded location. Never stored."
actionLabel="Update"
disabled={busy !== null}
onPress={async () => {
setBusy("weather");
const result=await syncWeather();
setBusy(null);
setNotice(
result.error ? result.error : `Weather updated for ${result.fetched} days.`,
);
}}
/>

<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
Your data
</Text>
<Text style={styles.rowHint} maxFontSizeMultiplier={2}>
{totalRows === null
? "Counting"
: `${totalRows} rows on this phone. None of it has been sent anywhere.`}
</Text>

<ActionRow
label="Export as JSON"
hint="Everything, exactly as stored."
actionLabel={busy === "json" ? "Working" : "Export"}
disabled={busy !== null}
onPress={() => doExport("json")}
/>
<ActionRow
label="Export as CSV"
hint="One file per table, opens in a spreadsheet."
actionLabel={busy === "csv" ? "Working" : "Export"}
disabled={busy !== null}
onPress={() => doExport("csv")}
/>

<Pressable
style={({ pressed }) => [styles.danger, pressed && styles.pressed, busy !== null && styles.disabled]}
disabled={busy !== null}
onPress={confirmDelete}
accessibilityRole="button"
accessibilityLabel="Delete everything on this phone"
>
{busy === "delete" ? (
<ActivityIndicator color={colors.danger} />
) : (
<Text style={styles.dangerText} maxFontSizeMultiplier={1.8}>
Delete everything
</Text>
)}
</Pressable>

<Text style={styles.sectionHeading} maxFontSizeMultiplier={2}>
What this app is
</Text>
<Text style={styles.body} maxFontSizeMultiplier={2}>
Scintilla records what you tell it and looks for patterns in it. It does
not diagnose, treat, predict, or prevent migraine. Loosen is relaxation
training. Anything the insights screen reports is an association in your
own diary, not a cause.
</Text>

<Pressable
style={styles.linkRow}
onPress={() => router.push("/insights")}
accessibilityRole="button"
accessibilityLabel="Open insights"
>
<Text style={styles.linkText} maxFontSizeMultiplier={2}>
Insights
</Text>
</Pressable>
</ScrollView>
);
}

function ActionRow({
label,
hint,
actionLabel,
onPress,
disabled,
}: {
label: string;
hint: string;
actionLabel: string;
onPress: () => void | Promise<void>;
disabled?: boolean;
}){
return (
<View style={styles.row}>
<View style={styles.rowLabels}>
<Text style={styles.rowLabel} maxFontSizeMultiplier={2}>
{label}
</Text>
{hint ? (
<Text style={styles.rowHint} maxFontSizeMultiplier={2}>
{hint}
</Text>
) : null}
</View>
<Pressable
onPress={() => void onPress()}
disabled={disabled}
style={({ pressed }) => [
styles.action,
pressed && styles.pressed,
disabled && styles.disabled,
]}
accessibilityRole="button"
accessibilityLabel={`${actionLabel} ${label}`}
>
<Text style={styles.actionText} maxFontSizeMultiplier={1.8}>
{actionLabel}
</Text>
</Pressable>
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
pressed: { opacity: 0.7 },
disabled: { opacity: 0.4 },

safetyCard: {
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surface,
borderLeftWidth: 3,
borderLeftColor: colors.warn,
gap: space.sm,
},
safetyHeading: { color: colors.warn, fontSize: typeScale.label },
safetyBody: { color: colors.textMuted, fontSize: typeScale.caption, lineHeight: 20 },

notice: {
padding: space.md,
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
minHeight: touch.min,
justifyContent: "center",
},
noticeText: { color: colors.text, fontSize: typeScale.label },

sectionHeading: { color: colors.textMuted, fontSize: typeScale.label, marginTop: space.lg },
body: { color: colors.textMuted, fontSize: typeScale.caption, lineHeight: 20 },

row: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
minHeight: touch.comfortable,
paddingVertical: space.sm,
},
rowLabels: { flex: 1, gap: 2 },
rowLabel: { color: colors.text, fontSize: typeScale.body },
rowHint: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 18 },

action: {
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
},
actionText: { color: colors.text, fontSize: typeScale.label },

danger: {
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
borderWidth: 1,
borderColor: colors.danger,
marginTop: space.md,
},
dangerText: { color: colors.danger, fontSize: typeScale.label },

linkRow: { minHeight: touch.comfortable, justifyContent: "center" },
linkText: { color: colors.accent, fontSize: typeScale.body },
});
