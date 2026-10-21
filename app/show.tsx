
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { Gyroscope } from "expo-sensors";
import * as Haptics from "expo-haptics";

import { cameraBackground, type CameraReport } from "@aura/schema";
import { AuraView, type AuraViewHandle } from "@/aura/AuraView";
import { useAuraDraft } from "@/aura/useAuraDraft";
import { latestAuraVersion } from "@/db/auraVersions";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

const MOTION_GAIN=90;
const MOTION_INTERVAL_MS=33;

export default function ShowScreen(){
useKeepAwake();
const auraRef=useRef<AuraViewHandle>(null);
const draft=useAuraDraft();
const [camera, setCamera]=useState<CameraReport | null>(null);
const [error, setError]=useState<string | null>(null);
const [loaded, setLoaded]=useState(false);

const point=useRef({ x: 0, y: 0 });
const size=useRef({ w: 0, h: 0 });

useEffect(() => {
let cancelled=false;
latestAuraVersion()
.then((v) => {
if(cancelled) return;
if(v) draft.load({ ...v.state, background: cameraBackground() });
else draft.setBackground(cameraBackground());
setLoaded(true);
})
.catch(() => {
if(!cancelled){
draft.setBackground(cameraBackground());
setLoaded(true);
}
});
return () => {
cancelled=true;
};
}, []);

useEffect(() => {
if(loaded) auraRef.current?.setState(draft.state);
}, [draft.state, loaded]);

useEffect(() => {
let sub: { remove: () => void } | null=null;
let cancelled=false;

Gyroscope.isAvailableAsync()
.then((available) => {
if(!available || cancelled) return;
Gyroscope.setUpdateInterval(MOTION_INTERVAL_MS);
sub=Gyroscope.addListener(({ x, y }) => {
const { w, h }=size.current;
if(w === 0 || h === 0) return;
const next={
x: Math.min(w, Math.max(0, point.current.x + y * MOTION_GAIN * (MOTION_INTERVAL_MS / 1000))),
y: Math.min(h, Math.max(0, point.current.y + x * MOTION_GAIN * (MOTION_INTERVAL_MS / 1000))),
};
point.current=next;
auraRef.current?.setMotion(next);
});
})
.catch(() => {});

return () => {
cancelled=true;
sub?.remove();
};
}, []);

const exit=useCallback(() => {
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
auraRef.current?.stopCamera();
router.back();
}, []);

const cameraFailed =
camera !== null && camera.status !== "live" && camera.status !== "requesting";

return (
<Pressable
style={styles.root}
onPress={exit}
onLayout={(e) => {
size.current={
w: e.nativeEvent.layout.width,
h: e.nativeEvent.layout.height,
};
point.current={ x: size.current.w / 2, y: size.current.h / 2 };
}}
accessibilityRole="button"
accessibilityLabel="Show mode. Tap anywhere to exit."
>
<AuraView
ref={auraRef}
onCamera={setCamera}
onError={setError}
pointerEventsNone
/>

{cameraFailed || error ? (
<View style={styles.overlay} pointerEvents="none">
<Text style={styles.overlayTitle}>The camera is not running</Text>
<Text style={styles.overlayBody}>
{error ??
(camera?.status === "denied"
? "Camera access was refused. You can change that in Settings."
: "This build cannot reach the camera from inside the renderer.")}
</Text>
<Text style={styles.overlayBody}>
Your aura is still shown, over the dark field instead.
</Text>
</View>
) : null}

<View style={styles.exitHint} pointerEvents="none">
<Text style={styles.exitHintText}>Tap anywhere to exit</Text>
</View>
</Pressable>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.auraBackdrop },
overlay: {
position: "absolute",
left: space.xl,
right: space.xl,
top: "40%",
gap: space.sm,
padding: space.lg,
borderRadius: radius.lg,
backgroundColor: "rgba(12,12,16,0.88)",
},
overlayTitle: { color: colors.text, fontSize: typeScale.heading },
overlayBody: { color: colors.textMuted, fontSize: typeScale.label },
exitHint: {
position: "absolute",
bottom: space.xxl,
alignSelf: "center",
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.pill,
backgroundColor: "rgba(12,12,16,0.6)",
},
exitHintText: { color: colors.textFaint, fontSize: typeScale.caption },
});
