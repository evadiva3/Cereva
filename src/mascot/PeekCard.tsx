import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, View } from "react-native";
import { colors } from "@/theme";
import { Mascot } from "./Mascot";
import { useCompanionMotion } from "./useCompanionMotion";
import type { MascotMood } from "./frames";

export function PeekCard({ children, size=128, side="right", paused=false, mood="idle", delay=0 }: {
children: ReactNode;
size?: number;
side?: "left" | "right";
paused?: boolean;
mood?: MascotMood;
delay?: number;
}){
const moving=useCompanionMotion(paused || mood === "resting" || mood === "with_you");
const emerge=useRef(new Animated.Value(1)).current;
useEffect(() => {
if(!moving){ emerge.setValue(1); return; }
emerge.setValue(0);
const animation=Animated.loop(Animated.sequence([
Animated.timing(emerge, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
Animated.delay(3800 + delay),
Animated.timing(emerge, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
Animated.delay(500),
]));
animation.start();
return () => animation.stop();
}, [moving, delay, emerge]);
const lip=size * 0.68;
const headroom=size * 0.12;
const windowHeight=lip + headroom;
return (
<View style={{ paddingTop: windowHeight }}>
<View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
style={{ position: "absolute", top: 0, [side]: 18, width: size, height: windowHeight + 2, overflow: "hidden" }}>
<Animated.View style={{ transform: [{ translateY: emerge.interpolate({ inputRange: [0, 1], outputRange: [headroom + size * 0.15, headroom - size * 0.08] }) }] }}>
<Mascot size={size} mood={mood} paused={paused} backdrop={colors.canvas} />
</Animated.View>
</View>
<View style={{ zIndex: 1 }}>{children}</View>
</View>
);
}
