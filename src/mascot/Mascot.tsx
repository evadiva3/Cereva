
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Image, StyleSheet, View } from "react-native";

import { hasMascot, moodFrames, type MascotMood } from "./frames";

interface Props {
mood?: MascotMood;
size?: number;
label?: string;
}

export function Mascot({ mood="idle", size=96, label }: Props){
const spec=moodFrames(mood);
const [i, setI]=useState(0);
const [still, setStill]=useState(false);
const timer=useRef<ReturnType<typeof setInterval> | null>(null);

useEffect(() => {
let alive=true;
AccessibilityInfo.isReduceMotionEnabled()
.then((on) => { if(alive) setStill(on); })
.catch(() => {});
const sub=AccessibilityInfo.addEventListener("reduceMotionChanged", setStill);
return () => { alive=false; sub.remove(); };
}, []);

useEffect(() => {
setI(0);
if(timer.current){
clearInterval(timer.current);
timer.current=null;
}
if(!spec || still || spec.frames.length < 2) return;
const ms=Math.max(1000 / Math.min(spec.fps, 12), 83);
timer.current=setInterval(() => {
setI((n) => {
const next=n + 1;
if(next >= spec.frames.length) return spec.loop ? 0 : n;
return next;
});
}, ms);
return () => {
if(timer.current) clearInterval(timer.current);
timer.current=null;
};
}, [spec, still, mood]);

if(!hasMascot() || !spec || spec.frames.length === 0) return null;

const frame=spec.frames[Math.min(i, spec.frames.length - 1)];
if(!frame) return null;

return (
<View style={[styles.wrap, { width: size, height: size }]} pointerEvents="none">
<Image
source={frame}
style={{ width: size, height: size }}
resizeMode="contain"
accessible={!!label}
accessibilityRole="image"
accessibilityLabel={label}
accessibilityIgnoresInvertColors
/>
</View>
);
}

const styles=StyleSheet.create({
wrap: { alignItems: "center", justifyContent: "center" },
});
