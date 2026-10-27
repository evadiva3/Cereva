import { useCallback, useEffect, useState } from "react";
import { AccessibilityInfo, AppState } from "react-native";
import { useFocusEffect } from "expo-router";

export function useCompanionMotion(paused=false){
const [focused, setFocused]=useState(false);
useFocusEffect(useCallback(() => {
setFocused(true);
return () => setFocused(false);
}, []));
const [reduced, setReduced]=useState(true);
const [active, setActive]=useState(AppState.currentState === "active");
useEffect(() => {
let mounted=true;
void AccessibilityInfo.isReduceMotionEnabled().then(value => {
if(mounted) setReduced(value);
}).catch(() => {});
const motion=AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
const state=AppState.addEventListener("change", value => setActive(value === "active"));
return () => { mounted=false; motion.remove(); state.remove(); };
}, []);
return focused && active && !reduced && !paused;
}
