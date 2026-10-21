
import { useCallback, useEffect, useRef, useState } from "react";
import {
ActivityIndicator,
Pressable,
ScrollView,
StyleSheet,
Text,
TextInput,
View,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { LAYER_LABELS, type Warning } from "@aura/schema";
import { AuraView, type AuraViewHandle } from "@/aura/AuraView";
import {
AiDisabledError,
AiNotConfiguredError,
describeAura,
isAiConfigured,
MAX_DESCRIPTION_LENGTH,
notableWarnings,
type DraftOutcome,
} from "@/ai/client";
import { AI_CONSENT_COPY, getAiConsent, setAiConsent } from "@/ai/consent";
import { saveAuraVersion } from "@/db/auraVersions";
import { AURA_DISCLAIMER, colors, radius, space, touch, type as typeScale } from "@/theme";

type Stage = "loading" | "consent" | "writing" | "working" | "review";

const EXAMPLES=[
"Static over everything, worse on the left, with trails behind moving things.",
"A bright jagged arc that grows out from the middle over about twenty minutes.",
"A soft blind spot just off to one side, and everything is too bright.",
];

export default function DescribeScreen(){
const auraRef=useRef<AuraViewHandle>(null);
const [stage, setStage]=useState<Stage>("loading");
const [description, setDescription]=useState("");
const [outcome, setOutcome]=useState<DraftOutcome | null>(null);
const [error, setError]=useState<string | null>(null);
const [busy, setBusy]=useState(false);

useEffect(() => {
getAiConsent()
.then((consent) => setStage(consent.granted ? "writing" : "consent"))
.catch(() => setStage("consent"));
}, []);

useEffect(() => {
if(stage === "review" && outcome) auraRef.current?.setState(outcome.state);
}, [stage, outcome]);

const accept=useCallback(async () => {
const granted=await setAiConsent(true);
void Haptics.selectionAsync();
setStage(granted.granted ? "writing" : "consent");
}, []);

const submit=useCallback(async () => {
setError(null);
setStage("working");
try {
const res=await describeAura(description, true);
setOutcome(res);
setStage("review");
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}catch(err){
if(err instanceof AiDisabledError || err instanceof AiNotConfiguredError){
setError(err.message);
setStage("consent");
return;
}
setError((err as Error).message);
setStage("writing");
}
}, [description]);

const keepDraft=useCallback(async () => {
if(!outcome) return;
setBusy(true);
try {
let thumbnailPath: string | null=null;
try {
const shot=await auraRef.current?.snapshot();
if(shot){
const { writeAuraImage }=await import("@/files");
thumbnailPath=writeAuraImage(shot.dataUrl, `${Date.now()}.png`);
}
}catch {
thumbnailPath=null;
}

await saveAuraVersion({
name: new Date().toLocaleDateString(undefined, {
year: "numeric",
month: "short",
day: "numeric",
}),
state: outcome.state,
thumbnailPath,
provenance: {
sourceText: description.trim(),
aiDraft: outcome.rawDraft,
model: outcome.model,
warnings: outcome.warnings,
},
});
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
router.back();
}catch(err){
setError(`Could not save: ${(err as Error).message}`);
}finally {
setBusy(false);
}
}, [outcome, description]);

if(stage === "loading"){
return (
<View style={styles.center}>
<ActivityIndicator color={colors.accent} />
</View>
);
}

if(stage === "consent"){
return (
<ScrollView style={styles.root} contentContainerStyle={styles.consentContent}>
<Text style={styles.title} maxFontSizeMultiplier={2}>
{AI_CONSENT_COPY.title}
</Text>
{AI_CONSENT_COPY.body.map((line, i) => (
<Text key={i} style={styles.consentLine} maxFontSizeMultiplier={2}>
{line}
</Text>
))}
{error ? <Text style={styles.error}>{error}</Text> : null}
{!isAiConfigured() ? (
<Text style={styles.error}>
This build has no AI server configured, so this cannot be turned on
here.
</Text>
) : null}
<Pressable
style={({ pressed }) => [
styles.primaryButton,
pressed && styles.pressed,
!isAiConfigured() && styles.disabled,
]}
disabled={!isAiConfigured()}
onPress={accept}
accessibilityRole="button"
accessibilityLabel={AI_CONSENT_COPY.acceptLabel}
>
<Text style={styles.primaryButtonText} maxFontSizeMultiplier={1.8}>
{AI_CONSENT_COPY.acceptLabel}
</Text>
</Pressable>
<Pressable
style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
onPress={() => router.back()}
accessibilityRole="button"
accessibilityLabel={AI_CONSENT_COPY.declineLabel}
>
<Text style={styles.secondaryButtonText} maxFontSizeMultiplier={1.8}>
{AI_CONSENT_COPY.declineLabel}
</Text>
</Pressable>
</ScrollView>
);
}

if(stage === "writing" || stage === "working"){
const working=stage === "working";
return (
<ScrollView style={styles.root} contentContainerStyle={styles.writingContent}>
<Text style={styles.title} maxFontSizeMultiplier={2}>
What do you see?
</Text>
<Text style={styles.subtitle} maxFontSizeMultiplier={2}>
Plain words are fine. You will be able to adjust everything afterwards.
</Text>

<TextInput
style={styles.input}
value={description}
onChangeText={setDescription}
editable={!working}
multiline
maxLength={MAX_DESCRIPTION_LENGTH}
placeholder="Static everywhere, worse on the left..."
placeholderTextColor={colors.textFaint}
accessibilityLabel="Describe your aura"
maxFontSizeMultiplier={2}
/>
<Text style={styles.counter}>
{description.trim().length} of {MAX_DESCRIPTION_LENGTH}
</Text>

{error ? <Text style={styles.error}>{error}</Text> : null}

<Text style={styles.examplesHeading} maxFontSizeMultiplier={2}>
For example
</Text>
{EXAMPLES.map((example) => (
<Pressable
key={example}
style={({ pressed }) => [styles.example, pressed && styles.pressed]}
onPress={() => setDescription(example)}
disabled={working}
accessibilityRole="button"
accessibilityLabel={`Use this example: ${example}`}
>
<Text style={styles.exampleText} maxFontSizeMultiplier={2}>
{example}
</Text>
</Pressable>
))}

<Pressable
style={({ pressed }) => [
styles.primaryButton,
pressed && styles.pressed,
(working || description.trim().length < 3) && styles.disabled,
]}
disabled={working || description.trim().length < 3}
onPress={submit}
accessibilityRole="button"
accessibilityLabel="Build a draft from this description"
>
{working ? (
<ActivityIndicator color={colors.accentText} />
) : (
<Text style={styles.primaryButtonText} maxFontSizeMultiplier={1.8}>
Build a draft
</Text>
)}
</Pressable>

<Text style={styles.footnote}>
Only these words are sent. Nothing else leaves your phone.
</Text>
</ScrollView>
);
}

const notable: Warning[]=outcome ? notableWarnings(outcome.warnings) : [];
return (
<View style={styles.root}>
<View style={styles.stage}>
<AuraView ref={auraRef} onError={setError} />
</View>

<ScrollView style={styles.reviewPanel} contentContainerStyle={styles.reviewContent}>
<Text style={styles.draftLabel} maxFontSizeMultiplier={2}>
This is a draft
</Text>

{outcome?.notes ? (
<Text style={styles.notes} maxFontSizeMultiplier={2}>
{outcome.notes}
</Text>
) : null}

{outcome && outcome.state.layers.length > 0 ? (
<Text style={styles.layerList} maxFontSizeMultiplier={2}>
{outcome.state.layers.map((l) => LAYER_LABELS[l.type]).join(", ")}
</Text>
) : (
<Text style={styles.error}>
Nothing in that description matched a layer this app has. Try
describing it differently, or build it by hand.
</Text>
)}

{notable.length > 0 ? (
<View style={styles.warnBox}>
<Text style={styles.warnHeading} maxFontSizeMultiplier={2}>
Changed from what was suggested
</Text>
{notable.map((w, i) => (
<Text key={`${w.path}-${i}`} style={styles.warnLine} maxFontSizeMultiplier={2}>
{w.path}: {w.message}
</Text>
))}
<Text style={styles.warnFootnote}>
Some limits exist for safety, particularly on how fast anything
can flash or move.
</Text>
</View>
) : null}

<Text style={styles.disclaimer}>{AURA_DISCLAIMER}</Text>
</ScrollView>

<View style={styles.footer}>
<Pressable
style={({ pressed }) => [styles.secondaryButton, styles.flex, pressed && styles.pressed]}
onPress={() => {
setOutcome(null);
setStage("writing");
}}
accessibilityRole="button"
accessibilityLabel="Discard this draft and write a different description"
>
<Text style={styles.secondaryButtonText} maxFontSizeMultiplier={1.8}>
Try again
</Text>
</Pressable>
<Pressable
style={({ pressed }) => [
styles.primaryButton,
styles.flex,
pressed && styles.pressed,
(busy || !outcome || outcome.state.layers.length === 0) && styles.disabled,
]}
disabled={busy || !outcome || outcome.state.layers.length === 0}
onPress={keepDraft}
accessibilityRole="button"
accessibilityLabel="Keep this draft and save it"
>
<Text style={styles.primaryButtonText} maxFontSizeMultiplier={1.8}>
Keep and adjust
</Text>
</Pressable>
</View>
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
center: { flex: 1, backgroundColor: colors.canvas, alignItems: "center", justifyContent: "center" },
flex: { flex: 1 },
pressed: { opacity: 0.7 },
disabled: { opacity: 0.4 },

consentContent: { padding: space.xl, gap: space.md, paddingBottom: space.xxl },
writingContent: { padding: space.xl, gap: space.md, paddingBottom: space.xxl },

title: { color: colors.text, fontSize: typeScale.title },
subtitle: { color: colors.textMuted, fontSize: typeScale.body },
consentLine: { color: colors.textMuted, fontSize: typeScale.body, lineHeight: typeScale.body * 1.5 },

input: {
minHeight: 120,
borderRadius: radius.md,
backgroundColor: colors.surface,
borderWidth: 1,
borderColor: colors.line,
padding: space.lg,
color: colors.text,
fontSize: typeScale.body,
textAlignVertical: "top",
},
counter: { color: colors.textFaint, fontSize: typeScale.caption, textAlign: "right" },

examplesHeading: { color: colors.textMuted, fontSize: typeScale.label, marginTop: space.md },
example: {
padding: space.md,
borderRadius: radius.md,
backgroundColor: colors.surface,
minHeight: touch.min,
justifyContent: "center",
},
exampleText: { color: colors.textMuted, fontSize: typeScale.caption },

error: { color: colors.warn, fontSize: typeScale.label },
footnote: { color: colors.textFaint, fontSize: typeScale.caption, textAlign: "center" },

stage: { height: "38%", backgroundColor: colors.auraBackdrop },
reviewPanel: { flex: 1 },
reviewContent: { padding: space.xl, gap: space.md },
draftLabel: { color: colors.accent, fontSize: typeScale.label },
notes: { color: colors.text, fontSize: typeScale.body, lineHeight: typeScale.body * 1.5 },
layerList: { color: colors.textMuted, fontSize: typeScale.caption },

warnBox: {
padding: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surface,
borderLeftWidth: 3,
borderLeftColor: colors.warn,
gap: space.xs,
},
warnHeading: { color: colors.warn, fontSize: typeScale.label },
warnLine: { color: colors.textMuted, fontSize: typeScale.caption },
warnFootnote: { color: colors.textFaint, fontSize: typeScale.caption, marginTop: space.xs },

disclaimer: { color: colors.textFaint, fontSize: typeScale.caption, textAlign: "center" },

footer: {
flexDirection: "row",
gap: space.sm,
padding: space.md,
borderTopWidth: StyleSheet.hairlineWidth,
borderTopColor: colors.line,
},
primaryButton: {
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.accent,
paddingHorizontal: space.lg,
},
primaryButtonText: { color: colors.accentText, fontSize: typeScale.label, textAlign: "center" },
secondaryButton: {
minHeight: touch.comfortable,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
paddingHorizontal: space.lg,
},
secondaryButtonText: { color: colors.text, fontSize: typeScale.label, textAlign: "center" },
});
