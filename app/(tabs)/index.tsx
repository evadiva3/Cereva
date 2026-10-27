
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { listDayLogs, quickMark, type DayLog, type Headache } from "@/db/dayLogs";
import { listAttacks, openAttack, type Attack } from "@/db/attacks";
import { getName } from "@/db/profile";
import { Mascot } from "@/mascot/Mascot";
import { addDays, dateRange, deviceWeekStart, parseLocalDate, startOfWeek, today } from "@/dates";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

type Href=Parameters<typeof router.push>[0];
type IconName=keyof typeof Ionicons.glyphMap;

const MARKS: { value: Headache; label: string; color: string }[]=[
{ value: "none", label: "Clear", color: colors.accentDim },
{ value: "mild", label: "Mild", color: colors.accentDim },
{ value: "moderate", label: "Rough", color: colors.warn },
{ value: "severe", label: "Bad", color: colors.danger },
];

const TILES: { label: string; icon: IconName; path: Href }[]=[
{ label: "Your aura", icon: "eye-outline", path: "/builder" },
{ label: "Check in", icon: "checkbox-outline", path: "/checkin" },
{ label: "Relaxation", icon: "leaf-outline", path: "/relaxation" },
{ label: "Insights", icon: "stats-chart-outline", path: "/insights" },
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

export default function TodayScreen(){
const insets=useSafeAreaInsets();
const [week, setWeek]=useState<DayLog[]>([]);
const [attack, setAttack]=useState<Attack | null>(null);
const [recent, setRecent]=useState<Attack[]>([]);
const [todayMark, setTodayMark]=useState<Headache | null>(null);
const [name, setName]=useState<string | null>(null);

const start=startOfWeek(today(), deviceWeekStart());
const days=dateRange(start, addDays(start, 6));

useFocusEffect(
useCallback(() => {
let alive=true;
const set=<T,>(f: (v: T) => void) => (v: T) => { if(alive) f(v); };
listDayLogs(start, addDays(start, 6)).then((rows) => {
if(!alive) return;
setWeek(rows);
setTodayMark(rows.find((r) => r.localDate === today())?.headache ?? null);
}).catch(() => {});
openAttack().then(set(setAttack)).catch(() => {});
listAttacks(4).then(set(setRecent)).catch(() => {});
getName().then(set(setName)).catch(() => {});
return () => { alive=false; };
}, [start]),
);

const go=useCallback((path: Href, heavy=false) => {
void Haptics.impactAsync(
heavy ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
);
router.push(path);
}, []);

const mark=useCallback(async (value: Headache) => {
void Haptics.selectionAsync();
setTodayMark(value);
try {
await quickMark(today(), value);
const rows=await listDayLogs(start, addDays(start, 6));
setWeek(rows);
} catch {
setTodayMark(null);
}
}, [start]);

const now=today();
const logged=new Set(week.map((d) => d.localDate));
const attackDays=new Set(week.filter((d) => d.attackDay).map((d) => d.localDate));
const mood=attack ? "with_you" : logged.has(now) ? "happy" : "idle";

return (
<ScrollView style={styles.root} contentContainerStyle={[styles.content,{paddingTop:insets.top+space.sm}]} showsVerticalScrollIndicator={false}>
<View style={styles.head}>
<Mascot mood={mood} size={64} label="Cereva" />
<View style={styles.headText}>
<Text style={styles.greeting} maxFontSizeMultiplier={1.6} numberOfLines={1}>
{`${greeting()}, ${name || "Eva"}`}
</Text>
<Text style={styles.status} maxFontSizeMultiplier={1.6} numberOfLines={1}>
{attack
? "An attack is being recorded."
: recent[0]
? `Last attack ${daysSince(recent[0].startedAt)}.`
: "Nothing recorded yet."}
</Text>
</View>
<Pressable
style={styles.gear}
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
<Text style={styles.dayName} maxFontSizeMultiplier={1.2}>
{dt.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
</Text>
<View style={[styles.dayNum, isToday && styles.dayNumToday]}>
<Text
style={[styles.dayNumText, isToday && styles.dayNumTextToday]}
maxFontSizeMultiplier={1.2}
>
{dt.getDate()}
</Text>
</View>
<View style={[styles.dot, was ? styles.dotAttack : has ? styles.dotLogged : null]} />
</Pressable>
);
})}
</View>

<Pressable
style={({ pressed }) => [
styles.voice,
attack ? styles.voiceOpen : null,
pressed && styles.pressed,
]}
onPress={() => go("/voice", true)}
accessibilityRole="button"
accessibilityLabel={
attack
? "An attack is in progress. Tap to say how it is going."
: "Attack in progress. Tap and talk, no forms."
}
>
<Ionicons name="mic" size={26} color={attack ? colors.danger : colors.accent} />
<View style={styles.flex}>
<Text
style={[styles.voiceTitle, attack ? styles.voiceTitleOpen : null]}
maxFontSizeMultiplier={1.4}
>
{attack ? "Attack in progress" : "Attack in progress?"}
</Text>
<Text style={styles.voiceHint} maxFontSizeMultiplier={1.4}>
{attack ? "Tap to say how it is going" : "Tap and just talk. No forms."}
</Text>
</View>
</Pressable>

<View style={styles.marks}>
<Text style={styles.marksLabel} maxFontSizeMultiplier={1.3}>
Today was
</Text>
<View style={styles.marksRow}>
{MARKS.map((m) => {
const on=todayMark === m.value;
return (
<Pressable
key={m.value}
style={({ pressed }) => [
styles.mark,
on && { backgroundColor: m.color, borderColor: m.color },
pressed && styles.pressed,
]}
onPress={() => void mark(m.value)}
accessibilityRole="radio"
accessibilityState={{ selected: on }}
accessibilityLabel={`${m.label}. One tap, nothing else to fill in.`}
>
<Text
style={[styles.markText, on && styles.markTextOn]}
maxFontSizeMultiplier={1.3}
numberOfLines={1}
>
{m.label}
</Text>
</Pressable>
);
})}
</View>
</View>

<View style={styles.tiles}>
{TILES.map((t) => (
<Pressable
key={t.label}
style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
onPress={() => go(t.path)}
accessibilityRole="button"
accessibilityLabel={t.label}
>
<Ionicons name={t.icon} size={26} color={colors.accent} />
<Text style={styles.tileLabel} maxFontSizeMultiplier={1.3} numberOfLines={1}>
{t.label}
</Text>
</Pressable>
))}
</View>

<View style={styles.recent}>
<View style={styles.recentHead}>
<Text style={styles.recentTitle} maxFontSizeMultiplier={1.4}>
Recent
</Text>
<Pressable
onPress={() => go("/insights")}
accessibilityRole="button"
accessibilityLabel="See everything in insights"
>
<Text style={styles.seeAll} maxFontSizeMultiplier={1.4}>
See all
</Text>
</Pressable>
</View>
{recent.length === 0 ? (
<Text style={styles.empty} maxFontSizeMultiplier={1.4}>
Nothing yet. Tap the microphone when one starts and just talk.
</Text>
) : (
recent.slice(0, 4).map((a) => (
<Pressable key={a.id} style={styles.recentRow} onPress={() => router.push({pathname:"/describe",params:{attackId:a.id}})} accessibilityRole="button" accessibilityLabel={`Create an aura from the attack ${daysSince(a.startedAt)}`}>
<View style={[styles.recentDot, !a.endedAt && styles.recentDotOpen]} />
<Text style={styles.recentWhen} maxFontSizeMultiplier={1.4} numberOfLines={1}>
{daysSince(a.startedAt)}
{a.endedAt ? "" : ", still going"}
</Text>
<Text style={styles.recentWhat} maxFontSizeMultiplier={1.4} numberOfLines={1}>
{a.severity ?? (a.meds ? "took something" : "no details")}  ›
</Text>
</Pressable>
))
)}
</View>

<Pressable
style={styles.safetyRow}
onPress={() => go("/settings")}
accessibilityRole="button"
accessibilityLabel="Sudden new or different symptoms, especially with weakness, numbness, trouble speaking, or loss of vision, need emergency care. Tap for the full note."
>
<Ionicons name="information-circle-outline" size={16} color={colors.textFaint} />
<Text style={styles.safety} maxFontSizeMultiplier={1.4} numberOfLines={2}>
Sudden new or different symptoms need emergency care. Cereva never
evaluates your symptoms.
</Text>
</Pressable>
</ScrollView>
);
}

const styles=StyleSheet.create({
root: { flex:1,backgroundColor:colors.canvas },
content:{paddingHorizontal:space.lg,paddingBottom:space.xl,gap:space.md},

head: { flexDirection: "row", alignItems: "center", gap: space.sm },
headText: { flex: 1, gap: 1 },
greeting: { color: colors.text, fontSize: typeScale.title },
status: { color: colors.textMuted, fontSize: typeScale.caption },
gear: { minWidth: touch.min, minHeight: touch.min, alignItems: "flex-end", justifyContent: "center" },

week: {
flexDirection: "row",
justifyContent: "space-between",
paddingVertical: space.sm,
paddingHorizontal: space.xs,
borderRadius: radius.lg,
backgroundColor: colors.surface,
},
day: { alignItems: "center", gap: space.xs, flex: 1, minHeight: touch.min },
dayName: { color: colors.textFaint, fontSize: typeScale.caption },
dayNum: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
dayNumToday: { backgroundColor: colors.accent },
dayNumText: { color: colors.textMuted, fontSize: typeScale.body },
dayNumTextToday: { color: colors.accentText },
dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "transparent" },
dotLogged: { backgroundColor: colors.accentDim },
dotAttack: { backgroundColor: colors.danger },

flex: { flex: 1, gap: 2 },

voice: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
minHeight: 96,
paddingHorizontal: space.lg,
paddingVertical: space.md,
borderRadius: radius.lg,
borderWidth: 1,
borderColor: colors.accentDim,
backgroundColor: colors.surface,
},
voiceOpen: { borderColor: colors.danger },
voiceTitle: { color: colors.text, fontSize: typeScale.heading },
voiceTitleOpen: { color: colors.danger },
voiceHint: { color: colors.textMuted, fontSize: typeScale.caption },

marks: { gap: space.xs },
marksLabel: { color: colors.textFaint, fontSize: typeScale.caption },
marksRow: { flexDirection: "row", gap: space.sm },
mark: {
flex: 1,
minHeight: touch.min,
alignItems: "center",
justifyContent: "center",
paddingHorizontal: space.xs,
borderRadius: radius.md,
borderWidth: 1,
borderColor: colors.line,
backgroundColor: colors.surface,
},
markText: { color: colors.textMuted, fontSize: typeScale.caption },
markTextOn: { color: colors.accentText },

tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.md, flexShrink:0 },
tile: {
flexBasis: "47%",
flexGrow: 1,
minHeight: 92,
alignItems: "flex-start",
justifyContent: "center",
gap: space.sm,
paddingHorizontal: space.lg,
borderRadius: radius.lg,
backgroundColor: colors.surface,
},
tileLabel: { color: colors.text, fontSize: typeScale.body },

recent: { gap: space.xs, marginTop: space.xs,flexShrink:0 },
recentHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
recentTitle: { color: colors.textFaint, fontSize: typeScale.caption },
seeAll: { color: colors.accent, fontSize: typeScale.caption },
empty: { color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 18 },
recentRow: {
flexDirection: "row",
alignItems: "center",
gap: space.sm,
paddingVertical: space.sm,
paddingHorizontal: space.md,
borderRadius: radius.md,
backgroundColor: colors.surface,
},
recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentDim },
recentDotOpen: { backgroundColor: colors.danger },
recentWhen: { flex: 1, color: colors.text, fontSize: typeScale.caption },
recentWhat: { color: colors.textFaint, fontSize: typeScale.caption },
safetyRow: { flexDirection: "row", alignItems: "center", gap: space.xs, paddingBottom: space.sm },
safety: { flex: 1, color: colors.textFaint, fontSize: typeScale.caption, lineHeight: 17 },

pressed: { opacity: 0.7 },
});
