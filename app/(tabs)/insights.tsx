import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { runEngine } from "../../packages/engine/src/engine";
import { explainFactor, REQUIRED_CAVEATS } from "../../packages/engine/src/explain";
import { engineProgress } from "../../packages/engine/src/progress";
import { FACTOR_LABELS, type DayRecord, type FactorResult } from "../../packages/engine/src/types";
import { buildEngineInput, saveEngineRun } from "@/db/engineAdapter";
import { summarizeDays, routineComparisons } from "@/insights/summary";
import { PeekCard } from "@/mascot/PeekCard";
import { cardDepth, colors, radius, space } from "@/theme";

const LEVELS=[
{label:"No pain",color:"#9dcbdd"},
{label:"Mild",color:"#9ebba8"},
{label:"Moderate",color:"#d9b77e"},
{label:"Severe",color:"#c98eab"},
{label:"Level not recorded",color:"#67727d"},
];
type Range=30 | 90 | "all";

export default function InsightsScreen(){
const [days,setDays]=useState<DayRecord[] | null>(null);
const [range,setRange]=useState<Range>(90);
const [error,setError]=useState<string | null>(null);
const [showOther,setShowOther]=useState(false);
const [showNotes,setShowNotes]=useState(false);
useFocusEffect(useCallback(() => {
let alive=true;
buildEngineInput().then(records => {
if(!alive) return;
setDays(records); setError(null);
const result=runEngine(records);
if(result.windowStart && result.windowEnd) void saveEngineRun(result.windowStart,result.windowEnd,result.engineVersion,result).catch(() => {});
}).catch((err:Error) => {if(alive) setError(err.message);});
return () => {alive=false;};
},[]));
const output=useMemo(() => days ? runEngine(days) : null,[days]);
const selected=useMemo(() => days ? range === "all" ? days : days.slice(-range) : [],[days,range]);
const summary=useMemo(() => summarizeDays(selected),[selected]);
const comparisons=useMemo(()=>routineComparisons(selected),[selected]);
if(error) return <View style={styles.center}><Text style={styles.body}>{error}</Text></View>;
if(!days || !output) return <View style={styles.center}><ActivityIndicator color={colors.accent} /></View>;
const progress=engineProgress(output,days.length);
const findings=output.results.filter(result => result.label === "linked_more" || result.label === "linked_fewer");
const other=output.results.filter(result => result.label !== "linked_more" && result.label !== "linked_fewer");
const recent=days.slice(-14);
const rangeLabel=range === "all" ? "All history" : `Last ${range} days`;
return (
<ScrollView style={styles.root} contentContainerStyle={styles.content}>
<View><Text style={styles.eyebrow}>YOUR DIARY</Text><Text style={styles.title}>Insights</Text></View>

<View style={styles.rangeRow}>{([30,90,"all"] as Range[]).map(value => <Pressable key={value} style={[styles.range,range === value && styles.rangeSelected]} onPress={() => setRange(value)} accessibilityRole="button" accessibilityState={{selected:range === value}}><Text style={[styles.rangeText,range === value && styles.rangeActive]}>{value === "all" ? "All history" : `${value} days`}</Text></Pressable>)}</View>
<View style={styles.stats}>
<Stat value={String(summary.logged)} label="Days logged" />
<Stat value={String(summary.attackDays)} label="Attack days" />
<Stat value={String(summary.counts[0])} label="No-pain days" />
<Stat value={summary.averageSleep === null ? "no data" : `${(summary.averageSleep/60).toFixed(1)}h`} label="Average sleep" />
</View>
<View style={styles.card}>
<Text style={styles.heading}>How your days felt</Text><Text style={styles.caption}>{rangeLabel} · recorded pain levels</Text>
<View style={styles.chartRow}>
<Donut counts={summary.counts} total={summary.logged} />
<View style={styles.legend}>{LEVELS.map((level,index) => <View key={level.label} style={styles.legendRow}><View style={[styles.dot,{backgroundColor:level.color}]} /><Text style={styles.legendLabel}>{level.label}</Text><Text style={styles.legendCount}>{summary.counts[index]}</Text></View>)}</View>
</View>
<Text style={styles.caption}>{summary.logged ? "Only logged days are counted. Missing pain levels stay separate." : "Your chart will fill in as you add daily check-ins."}</Text>
</View>
<View style={styles.card}>
<View style={styles.sectionTop}><Text style={styles.heading}>Recent days</Text><Text style={styles.caption}>Last 14 calendar days</Text></View>
{recent.length ? <View style={styles.trend}>{recent.map((day,index) => {
const severity=day.logged ? day.severity : null;
const level=severity !== null && severity>=0 && severity<=3 ? LEVELS[severity] : undefined;
return <View key={day.date} style={styles.trendDay} accessible accessibilityLabel={`${day.date}: ${!day.logged ? "not logged" : level?.label ?? "pain level not recorded"}`}>
<View style={styles.trendTrack}><View style={[styles.trendBar,{height:severity === null ? 4 : 8+severity*22,backgroundColor:level?.color ?? colors.lineStrong}]} /></View>
<Text style={styles.dayLabel}>{index%3 === 0 || index === recent.length-1 ? day.date.slice(-2) : " "}</Text>
</View>;
})}</View> : <Text style={styles.body}>No entries yet. Log a day and it shows up here.</Text>}
<Text style={styles.caption}>Taller bars show more pain. Gray marks mean the level wasn’t recorded.</Text>
</View>
<View style={styles.card}>
<Text style={styles.heading}>Pain alongside daily routines</Text>
<Text style={styles.caption}>{rangeLabel} · days with moderate or severe pain</Text>
{comparisons.length ? comparisons.map(item=><View key={item.label} style={{gap:8,paddingVertical:6}}><Text style={styles.heading}>{item.label}</Text><ProgressBar label={item.withLabel} have={item.withPain} need={item.withCount} /><ProgressBar label={item.withoutLabel} have={item.withoutPain} need={item.withoutCount} /></View>) : <Text style={styles.body}>Log sleep, stress and meals alongside pain. Comparisons appear when there are at least five recorded days in each group.</Text>}
<Text style={styles.caption}>Same-day diary comparisons. Differences may reflect other factors; they do not identify causes.</Text>
</View>
<PeekCard size={132} delay={2400}>
<View style={styles.card}>
<View style={styles.sectionTop}><Text style={styles.heading}>Patterns in the diary</Text><View style={styles.badge}><Text style={styles.badgeText}>{output.factorsAssessed} assessed</Text></View></View>
<Text style={styles.body}>{findings.length ? "These factors stood out in your recorded history." : progress.reporting ? "No factor has a clear association yet." : "Building enough history to compare factors."}</Text>
{!progress.reporting && <>
<ProgressBar label="Logged days" have={progress.loggedDays.have} need={progress.loggedDays.need} />
<ProgressBar label={output.mode === "continuous" ? "Worsening days" : "Attack starts"} have={progress.onsets.have} need={progress.onsets.need} />
<Text style={styles.caption}>Each factor also needs enough observations to compare.</Text>
</>}
<Text style={styles.caption}>Analysis uses all {output.loggedDays} logged days, independently of the chart filter.</Text>
</View>
</PeekCard>
{findings.map(result => <FactorCard key={result.factor} result={result} />)}
{other.length>0 && <>
<Pressable style={styles.disclosure} onPress={() => setShowOther(value => !value)} accessibilityRole="button" accessibilityState={{expanded:showOther}}><Text style={styles.link}>{showOther ? "Hide" : "View"} {other.length} other factors</Text><Ionicons name={showOther ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} /></Pressable>
{showOther && other.map(result => <FactorCard key={result.factor} result={result} />)}
</>}
<Pressable style={styles.disclosure} onPress={() => setShowNotes(value => !value)} accessibilityRole="button" accessibilityState={{expanded:showNotes}}><Text style={styles.link}>How to read these patterns</Text><Ionicons name={showNotes ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} /></Pressable>
<Text style={styles.caption}>Associations in a diary do not establish causes.</Text>
{showNotes && <View style={styles.card}>{REQUIRED_CAVEATS.map(note => <Text key={note} style={styles.body}>{note}</Text>)}</View>}
</ScrollView>
);
}

function Donut({counts,total}:{counts:number[];total:number}){
const segments=Array.from({length:80},(_,index) => {
const position=(index+0.5)/80*total;
let sum=0;
const level=counts.findIndex(count => {sum+=count; return position<sum;});
return total ? LEVELS[level]?.color ?? colors.line : colors.line;
});
return <View style={styles.donut} accessible accessibilityLabel={total ? counts.map((count,index) => `${LEVELS[index]!.label}: ${count} days`).join(", ") : "No logged days"}>
<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>{segments.map((color,index) => <View key={index} style={[styles.ringSegment,{backgroundColor:color,transform:[{rotate:`${index*4.5}deg`},{translateY:-55}]}]} />)}</View>
<Text style={styles.donutNumber}>{total}</Text><Text style={styles.donutLabel}>logged days</Text>
</View>;
}
function Stat({value,label}:{value:string;label:string}){return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.caption}>{label}</Text></View>;}
function ProgressBar({label,have,need}:{label:string;have:number;need:number}){return <View style={styles.progress} accessible accessibilityLabel={`${label}: ${have} of ${need}`}><View style={styles.sectionTop}><Text style={styles.caption}>{label}</Text><Text style={styles.count}>{have} / {need}</Text></View><View style={styles.track}><View style={[styles.fill,{width:`${Math.min(100,need ? have/need*100 : 100)}%`}]} /></View></View>;}
function FactorCard({result}:{result:FactorResult}){
const [expanded,setExpanded]=useState(false);
const label=result.label === "linked_more" ? result.continuousMode ? "More worsening days" : "More attack starts" : result.label === "linked_fewer" ? result.continuousMode ? "Fewer worsening days" : "Fewer attack starts" : result.label === "no_clear_link" ? "No clear link" : "Needs more data";
const icon=result.label === "linked_more" ? "trending-up" : result.label === "linked_fewer" ? "trending-down" : "remove-outline";
return <View style={styles.card}><Pressable style={styles.factorHeader} onPress={() => setExpanded(value => !value)} accessibilityRole="button" accessibilityState={{expanded}}><View style={styles.factorIcon}><Ionicons name={icon} size={23} color={colors.accent} /></View><View style={styles.factorCopy}><Text style={styles.heading}>{result.factor === "loosen_week" ? "Relaxation practice" : FACTOR_LABELS[result.factor]}</Text><Text style={styles.caption}>{label}</Text></View><Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} /></Pressable>{expanded && <Text style={styles.body}>{explainFactor(result).replace(/Loosen/g,"relaxation")}</Text>}</View>;
}
const styles=StyleSheet.create({
root:{flex:1,backgroundColor:colors.canvas},content:{padding:space.lg,gap:14,paddingBottom:40},center:{flex:1,backgroundColor:colors.canvas,alignItems:"center",justifyContent:"center"},
eyebrow:{color:colors.accent,fontSize:11,letterSpacing:1.5,marginBottom:6},title:{color:colors.text,fontSize:28,fontWeight:"600"},heading:{color:colors.text,fontSize:16,fontWeight:"600",flexShrink:1},body:{color:colors.textMuted,fontSize:14,lineHeight:21},caption:{color:colors.textMuted,fontSize:12,lineHeight:18},

rangeRow:{flexDirection:"row",backgroundColor:colors.surface,borderRadius:12,padding:4,gap:4},range:{flex:1,minHeight:42,alignItems:"center",justifyContent:"center",borderRadius:9},rangeSelected:{backgroundColor:colors.surfaceRaised},rangeText:{color:colors.textFaint,fontSize:13},rangeActive:{color:colors.accent,fontWeight:"600"},
stats:{flexDirection:"row",flexWrap:"wrap",gap:10},stat:{...cardDepth,width:"48%",flexGrow:1,padding:16,borderRadius:14,backgroundColor:colors.surface,gap:4},statValue:{color:colors.text,fontSize:28,fontWeight:"600"},
card:{...cardDepth,padding:16,borderRadius:radius.lg,backgroundColor:colors.surface,gap:10},chartRow:{flexDirection:"row",flexWrap:"wrap",alignItems:"center",justifyContent:"center",gap:16,paddingVertical:8},donut:{width:140,height:140,alignItems:"center",justifyContent:"center"},ringSegment:{position:"absolute",left:67,top:60,width:6,height:20,borderRadius:1},donutNumber:{color:colors.text,fontSize:30,fontWeight:"600"},donutLabel:{color:colors.textMuted,fontSize:11},legend:{flex:1,minWidth:125,gap:10},legendRow:{flexDirection:"row",alignItems:"center",gap:7},dot:{width:8,height:8,borderRadius:4},legendLabel:{flex:1,color:colors.textMuted,fontSize:12},legendCount:{color:colors.text,fontSize:13,fontWeight:"600"},
sectionTop:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8,flexWrap:"wrap"},trend:{flexDirection:"row",gap:5,paddingTop:8},trendDay:{flex:1,alignItems:"center",gap:6},trendTrack:{height:80,width:"100%",justifyContent:"flex-end"},trendBar:{width:"100%",maxWidth:22,alignSelf:"center",borderRadius:4},dayLabel:{color:colors.textFaint,fontSize:10},badge:{paddingHorizontal:8,paddingVertical:4,borderRadius:8,backgroundColor:colors.surfaceRaised},badgeText:{color:colors.accent,fontSize:11},
progress:{gap:7},count:{color:colors.text,fontSize:12},track:{height:7,borderRadius:7,backgroundColor:colors.line,overflow:"hidden"},fill:{height:7,backgroundColor:colors.accent,borderRadius:7},disclosure:{minHeight:44,flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8},link:{color:colors.accent,fontSize:14,flex:1},factorHeader:{flexDirection:"row",alignItems:"center",gap:12,minHeight:44},factorCopy:{flex:1,gap:4},factorIcon:{width:40,height:40,borderRadius:12,alignItems:"center",justifyContent:"center",backgroundColor:colors.surfaceRaised},
});
