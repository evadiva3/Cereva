
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
getDb().catch((err: Error) => setDbError(err.message));
}, []);

if(dbError){
return (
<View style={styles.fatal}>
<Text style={styles.fatalTitle}>Scintilla could not open its database</Text>
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
<Stack.Screen name="checkin" options={{ title: "Today", presentation: "modal" }} />
<Stack.Screen
name="loosen-player"
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
