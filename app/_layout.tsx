
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StyleSheet, Text, View } from "react-native";
import * as SystemUI from "expo-system-ui";

import { getDb } from "@/db";
import { colors, space, type as typeScale } from "@/theme";

export default function RootLayout(){
const [dbError, setDbError]=useState<string | null>(null);

useEffect(() => {
void SystemUI.setBackgroundColorAsync(colors.canvas);
getDb()
.then(async db => {
const seedMode=process.env.EXPO_PUBLIC_SEED_ON_LAUNCH;
if(seedMode === "1" || seedMode === "force"){
if(seedMode !== "force"){
const existing=await db.getFirstAsync("SELECT 1 FROM day_logs UNION ALL SELECT 1 FROM attacks LIMIT 1");
if(existing) return;
}
const { seedChronic }=await import("@/dev/seed");
const r=await seedChronic(180);
console.log("SEEDED", JSON.stringify(r));
}
})
.catch((err: Error) => setDbError(err.message));
}, []);

if(dbError){
return (
<View style={styles.fatal}>
<Text style={styles.fatalTitle}>Cereva could not open its database</Text>
<Text style={styles.fatalBody}>{dbError}</Text>
</View>
);
}

return (
<GestureHandlerRootView style={styles.root}>
<SafeAreaProvider>
<StatusBar style="light" />
<Stack
screenOptions={{
headerStyle: { backgroundColor: colors.canvas },
headerTintColor: colors.text,
headerTitleStyle: { fontSize: typeScale.heading },
headerShadowVisible: false,
contentStyle: { backgroundColor: colors.canvas },
}}
>
<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
<Stack.Screen
name="show"
options={{ headerShown: false, animation: "fade", presentation: "fullScreenModal" }}
/>
<Stack.Screen name="relaxation-player" options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }} />
<Stack.Screen name="checkin" options={{ title: "Today", presentation: "modal" }} />
<Stack.Screen
name="voice"
options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }}
/>
<Stack.Screen
name="muscle-relaxation"
options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }}
/>
<Stack.Screen
name="attack"
options={{ headerShown: false, presentation: "fullScreenModal", animation: "fade" }}
/>
<Stack.Screen name="describe" options={{ title: "Describe in words" }} />
<Stack.Screen name="versions" options={{ title: "Saved versions" }} />
<Stack.Screen name="compare" options={{ title: "Compare" }} />
</Stack>
</SafeAreaProvider>
</GestureHandlerRootView>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
fatal: {
flex: 1,
backgroundColor: colors.canvas,
alignItems: "center",
justifyContent: "center",
padding: space.xl,
gap: space.md,
},
fatalTitle: { color: colors.text, fontSize: typeScale.title, textAlign: "center" },
fatalBody: { color: colors.textMuted, fontSize: typeScale.body, textAlign: "center" },
});
