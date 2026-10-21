
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Brightness from "expo-brightness";
import * as Haptics from "expo-haptics";
import { useKeepAwake } from "expo-keep-awake";

import { endAttack, openAttack, startAttack, updateAttack, type Attack } from "@/db/attacks";
import { colors, radius, space, type as typeScale } from "@/theme";

const ATTACK_BRIGHTNESS=0.06;

export default function AttackScreen(){
useKeepAwake();
const [attack, setAttack]=useState<Attack | null>(null);
const [error, setError]=useState<string | null>(null);
const prevBright=useRef<number | null>(null);

useEffect(() => {
let cancelled=false;
(async () => {
try {
const { status }=await Brightness.requestPermissionsAsync();
if(status !== "granted" || cancelled) return;
prevBright.current=await Brightness.getBrightnessAsync();
await Brightness.setBrightnessAsync(ATTACK_BRIGHTNESS);
}catch {}
})();
return () => {
cancelled=true;
const prev=prevBright.current;
if(prev !== null){
Brightness.setBrightnessAsync(prev).catch(() => {});
}
};
}, []);

useEffect(() => {
let cancelled=false;
openAttack()
.then((found) => {
if(cancelled) return;
if(found) setAttack(found);
else return startAttack().then((created) => !cancelled && setAttack(created));
})
.catch((err: Error) => !cancelled && setError(err.message));
return () => {
cancelled=true;
};
}, []);

const patch=useCallback(
(fields: Parameters<typeof updateAttack>[1]) => {
if(!attack) return;
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
setAttack({ ...attack, ...fields } as Attack);
updateAttack(attack.id, fields).catch((err: Error) => setError(err.message));
},
[attack],
);

const finish=useCallback(() => {
if(!attack) return;
void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
endAttack(attack.id)
.then(() => router.back())
.catch((err: Error) => setError(err.message));
}, [attack]);

if(error){
return (
<View style={styles.root}>
<Text style={styles.error}>{error}</Text>
<BigButton label="Close" onPress={() => router.back()} />
</View>
);
}

if(!attack){
return (
<View style={styles.root}>
<Text style={styles.status}>Starting</Text>
</View>
);
}

return (
<View style={styles.root}>
<Text style={styles.heading} maxFontSizeMultiplier={1.6}>
Attack logged
</Text>
<Text style={styles.subheading} maxFontSizeMultiplier={1.6}>
Nothing else is needed. Add anything else whenever you want.
</Text>

<View style={styles.actions}>
<BigButton
label={attack.meds ? "Medication taken" : "Took medication"}
active={attack.meds}
onPress={() => patch({ meds: !attack.meds })}
/>
<BigButton
label={
attack.aura === "yes"
? "With aura"
: attack.aura === "no"
? "No aura"
: "Aura?"
}
active={attack.aura !== "unsure"}
onPress={() =>
patch({
aura: attack.aura === "unsure" ? "yes" : attack.aura === "yes" ? "no" : "unsure",
})
}
/>
<BigButton label="It has passed" onPress={finish} />
</View>

<Pressable
onPress={() => router.back()}
style={styles.leave}
accessibilityRole="button"
accessibilityLabel="Close this screen and leave the attack running"
>
<Text style={styles.leaveText} maxFontSizeMultiplier={1.6}>
Close
</Text>
</Pressable>
</View>
);
}

function BigButton({
label,
onPress,
active,
}: {
label: string;
onPress: () => void;
active?: boolean;
}){
return (
<Pressable
onPress={onPress}
style={({ pressed }) => [
styles.bigButton,
active && styles.bigButtonActive,
pressed && styles.bigButtonPressed,
]}
accessibilityRole="button"
accessibilityLabel={label}
accessibilityState={{ selected: !!active }}
>
<Text style={styles.bigButtonText} maxFontSizeMultiplier={1.6}>
{label}
</Text>
</Pressable>
);
}

const styles=StyleSheet.create({
root: {
flex: 1,
backgroundColor: "#000000",
padding: space.lg,
justifyContent: "center",
gap: space.lg,
},
heading: { color: "#8a8a96", fontSize: typeScale.title, textAlign: "center" },
subheading: {
color: "#55555f",
fontSize: typeScale.body,
textAlign: "center",
marginBottom: space.lg,
},
status: { color: "#55555f", fontSize: typeScale.body, textAlign: "center" },
error: { color: colors.danger, fontSize: typeScale.body, textAlign: "center" },

actions: { gap: space.lg },
bigButton: {
minHeight: 110,
alignItems: "center",
justifyContent: "center",
borderRadius: radius.lg,
backgroundColor: "#15151c",
borderWidth: 1,
borderColor: "#24242e",
paddingHorizontal: space.lg,
},
bigButtonActive: { backgroundColor: "#1e1e2a", borderColor: "#3a3a4a" },
bigButtonPressed: { backgroundColor: "#24242e" },
bigButtonText: { color: "#b5b5c2", fontSize: typeScale.title, textAlign: "center" },

leave: { alignSelf: "center", padding: space.lg, minHeight: 56, justifyContent: "center" },
leaveText: { color: "#44444e", fontSize: typeScale.body },
});
