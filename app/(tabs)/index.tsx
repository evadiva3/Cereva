
import { useCallback, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { listDayLogs, type DayLog } from "@/db/dayLogs";
import { listAttacks, openAttack, type Attack } from "@/db/attacks";
import { latestAuraVersion, type AuraVersion } from "@/db/auraVersions";
import { Mascot } from "@/mascot/Mascot";
import { addDays, dateRange, deviceWeekStart, parseLocalDate, startOfWeek, today } from "@/dates";
import { SAFETY_NOTE, colors, radius, space, touch, type as typeScale } from "@/theme";

type Href=Parameters<typeof router.push>[0];
type IconName=keyof typeof Ionicons.glyphMap;

const QUICK: { label: string; hint: string; icon: IconName; path: Href }[]=[
{ label: "Check in", hint: "Log today", icon: "checkbox-outline", path: "/checkin" },
{ label: "Loosen", hint: "Unclench", icon: "leaf-outline", path: "/loosen" },
{ label: "Describe", hint: "In words", icon: "chatbubble-ellipses-outline", path: "/describe" },
{ label: "Insights", hint: "Patterns", icon: "stats-chart-outline", path: "/insights" },
];

function greeting(d=new Date()){
const h=d.getHours();
if(h < 5) return "Late night";
if(h < 12) return "Good morning";
if(h < 18) return "Good afternoon";
return "Good evening";
}

function daysSince(iso: string){
const d=Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
if(d <= 0) return "today";
if(d === 1) return "yesterday";
return `${d} days ago`;
}

function attackLine(a: Attack){
const bits: string[]=[];
if(a.severity) bits.push(a.severity);
if(a.aura === "yes") bits.push("with aura");
if(a.meds) bits.push("medication");
return bits.length > 0 ? bits.join(", ") : "no details";
}

export default function TodayScreen(){
const insets=useSafeAreaInsets();
const [week, setWeek]=useState<DayLog[]>([]);
const [attack, setAttack]=useState<Attack | null>(null);
const [recent, setRecent]=useState<Attack[]>([]);
const [aura, setAura]=useState<AuraVersion | null>(null);

const start=startOfWeek(today(), deviceWeekStart());
const days=dateRange(start, addDays(start, 6));

useFocusEffect(
useCallback(() => {
let alive=true;
const set=<T,>(f: (v: T) => void) => (v: T) => { if(alive) f(v); };
listDayLogs(start, addDays(start, 6)).then(set(setWeek)).catch(() => {});
openAttack().then(set(setAttack)).catch(() => {});
listAttacks(3).then(set(setRecent)).catch(() => {});
latestAuraVersion().then(set(setAura)).catch(() => {});
return () => { alive=false; };
}, [start]),
);

const go=useCallback((path: Href, heavy=false) => {
void Haptics.impactAsync(
heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
);
router.push(path);
}, []);

const now=today();
const logged=new Set(week.map((d) => d.localDate));
const attackDays=new Set(week.filter((d) => d.attackDay).map((d) => d.localDate));
const mood=attack ? "with_you" : logged.has(now) ? "happy" : "idle";

return (
<ScrollView
style={styles.root}
contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}
>
<View style={styles.head}>
<Text style={styles.greeting} maxFontSizeMultiplier={2}>
{greeting()}
</Text>
<Pressable
style={({ pressed }) => [styles.gear, pressed && styles.pressed]}
onPress={() => go("/settings")}
accessibilityRole="button"
accessibilityLabel="Settings"
>
<Ionicons name="person-circle-outline" size={30} color={colors.textMuted} />
</Pressable>
</View>

<View style={styles.week}>
{days.map((d) => {
const isToday=d === now;
const has=logged.has(d);
const was=attackDays.has(d);
const dt=parseLocalDate(d);
return (
<Pressable
key={d}
style={styles.day}
onPress={() => go("/checkin")}
accessibilityRole="button"
accessibilityLabel={`${dt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}${has ? ", logged" : ", not logged"}${was ? ", attack day" : ""}`}
>
<Text style={styles.dayName} maxFontSizeMultiplier={1.4}>
{dt.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
</Text>
<View style={[styles.dayNum, isToday && styles.dayNumToday]}>
<Text
style={[styles.dayNumText, isToday && styles.dayNumTextToday]}
maxFontSizeMultiplier={1.4}
>
{dt.getDate()}
</Text>
</View>
<View style={[styles.dot, was ? styles.dotAttack : has ? styles.dotLogged : null]} />
</Pressable>
);
})}
</View>

{attack ? (
<Pressable
style={({ pressed }) => [styles.openAttack, pressed && styles.pressed]}
onPress={() => go("/attack", true)}
accessibilityRole="button"
accessibilityLabel="An attack is in progress. Open it to update or end it."
>
<Ionicons name="radio-button-on" size={24} color={colors.danger} />
<View style={styles.flex}>
<Text style={styles.openAttackTitle} maxFontSizeMultiplier={1.8}>
Attack in progress
</Text>
<Text style={styles.hint} maxFontSizeMultiplier={1.8}>
Started {daysSince(attack.startedAt)}. Tap to update or end.
</Text>
</View>
</Pressable>
) : null}

<View style={styles.sectionHead}>
<Text style={styles.sectionTitle} maxFontSizeMultiplier={1.8}>
Your aura
</Text>
<Pressable
onPress={() => go("/versions")}
accessibilityRole="button"
accessibilityLabel="See all saved aura versions"
>
<Text style={styles.seeAll} maxFontSizeMultiplier={1.8}>
See all
</Text>
</Pressable>
</View>

<Pressable
style={({ pressed }) => [styles.hero, pressed && styles.pressed]}
onPress={() => go(aura ? "/show" : "/builder")}
accessibilityRole="button"
accessibilityLabel={aura ? "Show someone your aura" : "Build your aura"}
>
<View style={styles.heroText}>
<Text style={styles.heroTitle} maxFontSizeMultiplier={1.8}>
{aura ? "Show someone" : "Build your aura"}
</Text>
<Text style={styles.heroBody} maxFontSizeMultiplier={1.8}>
{aura
? "Full screen, over the live camera."
: "Start from a preset and make it look like what you see."}
</Text>
</View>
{aura?.thumbnailPath ? (
<Image
source={{ uri: aura.thumbnailPath }}
style={styles.heroThumb}
accessibilityIgnoresInvertColors
/>
) : (
<Mascot mood={mood} size={84} />
)}
</Pressable>

<Text style={styles.sectionTitle} maxFontSizeMultiplier={1.8}>
Quick actions
</Text>
<ScrollView
horizontal
showsHorizontalScrollIndicator={false}
contentContainerStyle={styles.quickRow}
>
{QUICK.map((q) => (
<Pressable
key={q.label}
style={({ pressed }) => [styles.quick, pressed && styles.pressed]}
onPress={() => go(q.path)}
accessibilityRole="button"
accessibilityLabel={`${q.label}. ${q.hint}.`}
>
<Ionicons name={q.icon} size={20} color={colors.accent} />
<Text style={styles.quickLabel} maxFontSizeMultiplier={1.6}>
{q.label}
</Text>
<Text style={styles.hint} maxFontSizeMultiplier={1.6}>
{q.label === "Check in" && logged.has(now) ? "Logged" : q.hint}
</Text>
</Pressable>
))}
</ScrollView>

<View style={styles.sectionHead}>
<Text style={styles.sectionTitle} maxFontSizeMultiplier={1.8}>
Recent attacks
</Text>
{recent.length > 0 ? (
<Pressable
onPress={() => go("/insights")}
accessibilityRole="button"
accessibilityLabel="See all attacks in insights"
>
<Text style={styles.seeAll} maxFontSizeMultiplier={1.8}>
See all
</Text>
</Pressable>
) : null}
</View>

{recent.length === 0 ? (
<Text style={styles.empty} maxFontSizeMultiplier={1.8}>
Nothing recorded yet. Use the button in the tab bar when one starts.
</Text>
) : (
recent.map((a) => (
<View key={a.id} style={styles.row}>
<View style={[styles.rowDot, !a.endedAt && styles.rowDotOpen]} />
<View style={styles.flex}>
<Text style={styles.rowTitle} maxFontSizeMultiplier={1.8}>
{daysSince(a.startedAt)}
{a.endedAt ? "" : ", still open"}
</Text>
<Text style={styles.hint} maxFontSizeMultiplier={1.8}>
{attackLine(a)}
</Text>
</View>
</View>
))
)}

<Text style={styles.safety} maxFontSizeMultiplier={2}>
{SAFETY_NOTE}
</Text>
</ScrollView>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
content: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
flex: { flex: 1, gap: 2 },

head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
greeting: { color: colors.text, fontSize: typeScale.display },
gear: { minWidth: touch.min, minHeight: touch.min, alignItems: "flex-end", justifyContent: "center" },

week: {
flexDirection: "row",
justifyContent: "space-between",
paddingVertical: space.md,
paddingHorizontal: space.sm,
borderRadius: radius.lg,
backgroundColor: colors.surface,
},
day: { alignItems: "center", gap: space.xs, flex: 1, minHeight: touch.min },
dayName: { color: colors.textFaint, fontSize: typeScale.caption },
dayNum: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
dayNumToday: { backgroundColor: colors.accent },
dayNumText: { color: colors.textMuted, fontSize: typeScale.body },
dayNumTextToday: { color: colors.accentText },
dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },
dotLogged: { backgroundColor: colors.accentDim },
dotAttack: { backgroundColor: colors.danger },

openAttack: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
padding: space.lg,
borderRadius: radius.lg,
borderWidth: 1,
borderColor: colors.danger,
backgroundColor: colors.surface,
},
openAttackTitle: { color: colors.danger, fontSize: typeScale.heading },

sectionHead: {
flexDirection: "row",
alignItems: "center",
justifyContent: "space-between",
marginTop: space.sm,
},
sectionTitle: { color: colors.text, fontSize: typeScale.heading },
seeAll: { color: colors.accent, fontSize: typeScale.label },

hero: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
minHeight: 116,
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surfaceRaised,
},
heroText: { flex: 1, gap: space.xs },
heroTitle: { color: colors.text, fontSize: typeScale.title },
heroBody: { color: colors.textMuted, fontSize: typeScale.caption, lineHeight: 19 },
heroThumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.auraBackdrop },

quickRow: { gap: space.md, paddingRight: space.lg },
quick: {
width: 132,
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surface,
gap: space.xs,
},
quickLabel: { color: colors.text, fontSize: typeScale.body },
hint: { color: colors.textFaint, fontSize: typeScale.caption },

empty: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 19 },
row: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
paddingVertical: space.md,
paddingHorizontal: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surface,
},
rowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentDim },
rowDotOpen: { backgroundColor: colors.danger },
rowTitle: { color: colors.text, fontSize: typeScale.body },

pressed: { opacity: 0.7 },
safety: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 19, marginTop: space.lg },
});
