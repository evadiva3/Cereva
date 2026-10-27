import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";
import { colors } from "@/theme";
import { ATLASES, REST, WAVE, WALK, type MascotMood } from "./frames";
import { useCompanionMotion } from "./useCompanionMotion";

interface Props {
mood?: MascotMood;
size?: number;
label?: string;
paused?: boolean;
peek?: boolean;
walking?: boolean;
facing?: "left" | "right";
backdrop?: string;
}

export function Mascot({ mood="idle", size=96, label, paused=false, peek=false, walking=false, facing="right", backdrop=colors.canvas }: Props){
const moving=useCompanionMotion(paused || mood === "with_you" || mood === "resting");
const clock=useRef(new Animated.Value(0)).current;
const breathe=useRef(new Animated.Value(0)).current;
const turn=useRef(new Animated.Value(facing === "left" ? -1 : 1)).current;
const [loaded, setLoaded]=useState<Record<string, boolean>>({});
const timeline=useMemo(() => {
const sequence=walking ? WALK : WAVE;
const base=sequence[0] ?? REST;
let time=0;
const transitions=[...sequence.slice(1), base].map((pose) => {
const start=time;
time+=walking ? 125 : 190;
return { pose, start, end:time };
});
return { base, transitions, duration:time + (walking ? 0 : 3200) };
},[walking]);
const poses=[timeline.base, ...timeline.transitions.map(({pose}) => pose)];
const ready=poses.every(pose => loaded[`${pose.atlas}:${pose.frame}`]);
const opacity=useMemo(() => timeline.transitions.map((transition,index) => {
const next=timeline.transitions[index + 1];
const inputRange=transition.start === 0 ? [0,transition.end] : [0,transition.start,transition.end];
const outputRange=transition.start === 0 ? [0,1] : [0,0,1];
if(next){
inputRange.push(next.end - 0.01,next.end);
outputRange.push(1,0);
}
return clock.interpolate({inputRange,outputRange,extrapolate:"clamp"});
}),[timeline,clock]);

useEffect(() => {
clock.setValue(0);
if(!moving || !ready) return;
const animation=Animated.loop(Animated.timing(clock,{
toValue:timeline.duration,duration:timeline.duration,easing:Easing.linear,
useNativeDriver:true,isInteraction:false,
}));
animation.start();
return () => animation.stop();
},[moving,ready,timeline,clock]);

useEffect(() => {
if(!moving || !ready || walking) return;
const animation=Animated.loop(Animated.sequence([
Animated.timing(breathe,{toValue:1,duration:2200,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
Animated.timing(breathe,{toValue:0,duration:2600,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false}),
]));
animation.start();
return () => { animation.stop(); breathe.setValue(0); };
},[moving,ready,walking,breathe]);

useEffect(() => {
const animation=Animated.timing(turn,{toValue:facing === "left" ? -1 : 1,duration:moving ? 420 : 0,easing:Easing.inOut(Easing.sin),useNativeDriver:true,isInteraction:false});
animation.start();
return () => animation.stop();
},[facing,moving,turn]);

return (
<View pointerEvents="none" accessible={!!label} accessibilityRole="image" accessibilityLabel={label}
style={{width:size,height:peek ? size * 0.78 : size,overflow:"hidden"}}>
<Animated.View style={{width:size,height:size,opacity:0.94,transform:[
{scaleX:turn},
{scaleY:breathe.interpolate({inputRange:[0,1],outputRange:[0.985,1]})},
]}}>
{poses.map((pose,index) => {
const atlas=ATLASES[pose.atlas];
const key=`${pose.atlas}:${pose.frame}`;
return (
<Animated.View key={`${walking}:${index}`} style={[styles.tile,{width:size,height:size,backgroundColor:backdrop,opacity:index === 0 ? 1 : opacity[index - 1]}]}>
<Image source={atlas.source} fadeDuration={0} resizeMode="stretch" accessible={false} accessibilityIgnoresInvertColors
onLoad={() => setLoaded(old => old[key] ? old : {...old,[key]:true})}
style={{position:"absolute",width:size / 0.96 * atlas.columns,height:size / 0.96 * atlas.rows,
left:-((pose.frame % atlas.columns) + 0.02) * size / 0.96,top:-(Math.floor(pose.frame / atlas.columns) + 0.02) * size / 0.96}} />
</Animated.View>
);
})}
</Animated.View>
</View>
);
}
const styles=StyleSheet.create({tile:{position:"absolute",overflow:"hidden"}});
