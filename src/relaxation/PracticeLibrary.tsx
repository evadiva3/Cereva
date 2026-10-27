import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { cardDepth, colors, radius, space, touch } from "@/theme";
export function PracticeLibrary(){
const [kind,setKind]=useState<"meditation"|"breathing">("meditation");
const [minutes,setMinutes]=useState(3);
return <View style={styles.card}>
<Text style={styles.title}>Take a break</Text>
<Text style={styles.description}>Pick one.</Text>
<View style={styles.row}>{(["meditation","breathing"] as const).map(value => <Pressable key={value} style={[styles.choice,kind===value && styles.selected]} accessibilityRole="tab" accessibilityState={{selected:kind===value}} onPress={() => {setKind(value);setMinutes(value==="breathing" ? 2 : 3);}}><Text style={styles.text}>{value==="meditation" ? "Meditation" : "Breathing"}</Text></Pressable>)}</View>
<Text style={styles.description}>{kind==="meditation" ? "Short prompts, read out loud if you want them." : "Breathe with the circle. No holds. Go at your own speed."}</Text>
<View style={styles.row}>{(kind==="meditation" ? [3,5,10] : [2,5]).map(value => <Pressable key={value} style={[styles.choice,minutes===value && styles.selected]} accessibilityRole="radio" accessibilityLabel={`${value} minutes`} accessibilityState={{selected:minutes===value}} onPress={() => setMinutes(value)}><Text style={styles.text}>{value} min</Text></Pressable>)}</View>
<Pressable style={styles.start} accessibilityRole="button" onPress={() => router.push({pathname:"/relaxation-player",params:{kind,seconds:String(minutes*60)}})}><Text style={styles.startText}>{kind==="meditation" ? "Start meditation" : "Start breathing"}</Text></Pressable>
</View>;
}
const styles=StyleSheet.create({card:{...cardDepth,backgroundColor:colors.surfaceRaised,borderRadius:radius.lg,padding:space.lg,gap:space.md},title:{color:colors.text,fontSize:22},description:{color:colors.textMuted,fontSize:15,lineHeight:22},row:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{minHeight:44,paddingHorizontal:16,justifyContent:"center",borderRadius:radius.pill,borderWidth:1,borderColor:colors.line},selected:{borderColor:colors.accent,backgroundColor:colors.surface},text:{color:colors.text,fontSize:15},start:{minHeight:touch.comfortable,justifyContent:"center",alignItems:"center",borderRadius:radius.md,backgroundColor:colors.accent},startText:{color:colors.accentText,fontSize:16}});
