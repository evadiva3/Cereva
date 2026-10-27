import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Speech from "expo-speech";
import { colors, radius, space, touch } from "@/theme";
import { useCompanionMotion } from "@/mascot/useCompanionMotion";
import { practiceCue, practiceDuration, type Practice } from "@/relaxation/sessions";

export default function RelaxationPlayer(){
useKeepAwake();
const params=useLocalSearchParams<{ kind?: string; seconds?: string }>();
const kind: Practice=params.kind === "breathing" ? "breathing" : "meditation";
const duration=practiceDuration(params.seconds);
const insets=useSafeAreaInsets();
const [elapsed,setElapsed]=useState(0);
const [running,setRunning]=useState(false);
const [voice,setVoice]=useState(false);
const accumulated=useRef(0);
const started=useRef(0);
const circle=useRef(new Animated.Value(0.82)).current;
const animate=useCompanionMotion(!running);
const done=elapsed>=duration;
const cue=practiceCue(kind,elapsed,duration);
const remaining=Math.max(0,Math.ceil(duration-elapsed));
const cueRef=useRef(cue);
cueRef.current=cue;

useEffect(() => {
if(!running) return;
started.current=Date.now();
const timer=setInterval(() => {
const next=Math.min(duration,accumulated.current+(Date.now()-started.current)/1000);
setElapsed(next);
if(next>=duration) setRunning(false);
}, 200);
return () => {
clearInterval(timer);
accumulated.current=Math.min(duration,accumulated.current+(Date.now()-started.current)/1000);
setElapsed(accumulated.current);
};
}, [running,duration]);
useEffect(() => {
const sub=AppState.addEventListener("change",state => {
if(state !== "active") { setRunning(false); void Speech.stop(); }
});
return () => { sub.remove(); void Speech.stop(); };
}, []);
useEffect(() => {
let cancelled=false;
void Speech.stop().then(() => {
if(!cancelled && running && voice && !done){
Speech.speak(kind === "breathing" ? cueRef.current.title : cueRef.current.text,{ rate:0.68,pitch:0.9 });
}
}).catch(() => {});
return () => { cancelled=true; void Speech.stop().catch(() => {}); };
}, [running,voice,done,kind,cue.index]);
useEffect(() => {
if(!animate || kind !== "breathing") return;
const animation=Animated.timing(circle,{ toValue:cueRef.current.inhale ? 1.08 : 0.82,duration:cueRef.current.remaining*1000,easing:Easing.inOut(Easing.sin),useNativeDriver:true });
animation.start();
return () => animation.stop();
}, [animate,kind,cue.index,circle]);

return <ScrollView style={styles.root} contentContainerStyle={[styles.content,{paddingTop:insets.top+16,paddingBottom:insets.bottom+24}]}>
<Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel="Close relaxation session"><Text style={styles.link}>Close</Text></Pressable>
<Text style={styles.eyebrow}>{kind === "breathing" ? "BREATHING" : "MEDITATION"}</Text>
<Text style={styles.title}>{done ? "Done" : !running && elapsed===0 ? "Ready" : !running ? "Paused" : cue.title}</Text>
<View style={styles.orbit} accessible={false}>
<Animated.View style={[styles.circle,{transform:[{scale:kind === "breathing" ? circle : 1}]}]} />
<View style={styles.timerWrap}><Text style={styles.timer}>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")}</Text><Text style={styles.timerLabel}>{done ? "Complete" : "remaining"}</Text></View>
</View>
<Text style={styles.guide}>{done ? "That is the session. Sit here as long as you want." : cue.text}</Text>
{kind === "breathing" && <Text style={styles.note}>An optional rhythm: 4 seconds in, 6 out, with no holds. Breathe normally if the pace feels uncomfortable, and stop if you feel lightheaded.</Text>}
<View style={styles.voice}><Text style={styles.body}>Spoken guidance</Text><Switch value={voice} onValueChange={setVoice} accessibilityLabel="Spoken guidance" trackColor={{false:colors.line,true:colors.accentDim}} /></View>
<Text style={styles.note}>The session pauses when you leave the app or lock your phone.</Text>
{done ? <Pressable style={styles.primary} onPress={() => router.back()} accessibilityRole="button"><Text style={styles.primaryText}>Back to Relaxation</Text></Pressable> :
<Pressable style={styles.primary} onPress={() => setRunning(value => !value)} accessibilityRole="button"><Text style={styles.primaryText}>{running ? "Pause" : elapsed>0 ? "Resume" : "Start"}</Text></Pressable>}
</ScrollView>;
}
const styles=StyleSheet.create({
root:{flex:1,backgroundColor:colors.canvas},content:{flexGrow:1,paddingHorizontal:24,gap:20,alignItems:"center"},
close:{alignSelf:"flex-start",minHeight:44,justifyContent:"center"},link:{color:colors.textMuted,fontSize:16},
eyebrow:{color:colors.accent,fontSize:12,letterSpacing:2},title:{color:colors.text,fontSize:28,textAlign:"center"},
orbit:{width:240,height:240,alignItems:"center",justifyContent:"center",marginVertical:16},
circle:{position:"absolute",width:204,height:204,borderRadius:102,backgroundColor:colors.surfaceRaised,borderWidth:2,borderColor:colors.accentDim},
timerWrap:{alignItems:"center",gap:4},timer:{color:colors.text,fontSize:36,fontVariant:["tabular-nums"]},timerLabel:{color:colors.textMuted,fontSize:13},
guide:{color:colors.text,fontSize:18,lineHeight:28,textAlign:"center",maxWidth:500},note:{color:colors.textFaint,fontSize:13,lineHeight:20,textAlign:"center",maxWidth:500},
voice:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",width:"100%",maxWidth:500},body:{color:colors.textMuted,fontSize:16},
primary:{minHeight:touch.comfortable,alignSelf:"stretch",alignItems:"center",justifyContent:"center",backgroundColor:colors.accent,borderRadius:radius.lg,padding:space.md},primaryText:{color:colors.accentText,fontSize:17},
});
