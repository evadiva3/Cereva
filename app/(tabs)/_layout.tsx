
import type { ColorValue } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { colors, radius, space, type as typeScale } from "@/theme";

type IconName=keyof typeof Ionicons.glyphMap;

function icon(name: IconName){
return ({ color, size }: { color: ColorValue; size: number }) => (
<Ionicons name={name} color={color as string} size={size} />
);
}

function RecordButton(){
return (
<View style={styles.fabSlot}>
<Pressable
style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
onPress={() => {
void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
router.push("/voice");
}}
accessibilityRole="button"
accessibilityLabel="Record a migraine attack starting now"
>
<Ionicons name="add" size={30} color={colors.accentText} />
</Pressable>
</View>
);
}

export default function TabsLayout(){
return (
<Tabs
screenOptions={{
headerStyle: { backgroundColor: colors.canvas },
headerTintColor: colors.text,
headerTitleStyle: { fontSize: typeScale.heading },
headerShadowVisible: false,
sceneStyle: { backgroundColor: colors.canvas },
tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, height: 88 },
tabBarActiveTintColor: colors.accent,
tabBarInactiveTintColor: colors.textFaint,
tabBarLabelStyle: { fontSize: 11 },
}}
>
<Tabs.Screen
name="index"
options={{ title: "Today", headerShown: false, tabBarIcon: icon("home-outline") }}
/>
<Tabs.Screen
name="builder"
options={{ title: "Your aura", tabBarLabel: "Aura", tabBarIcon: icon("eye-outline") }}
/>
<Tabs.Screen
name="record"
options={{ title: "Record", tabBarLabel: () => null, tabBarButton: () => <RecordButton /> }}
/>
<Tabs.Screen
name="insights"
options={{ title: "Insights", tabBarIcon: icon("stats-chart-outline") }}
/>
<Tabs.Screen
name="relaxation"
options={{ title: "Relaxation", tabBarIcon: icon("leaf-outline") }}
/>
<Tabs.Screen name="settings" options={{ title: "Settings", href: null }} />
</Tabs>
);
}

const styles=StyleSheet.create({
fabSlot: { flex: 1, alignItems: "center", justifyContent: "flex-start", paddingTop: space.xs },
fab: {
width: 54,
height: 54,
borderRadius: radius.pill,
backgroundColor: colors.accent,
alignItems: "center",
justifyContent: "center",
},
fabPressed: { opacity: 0.75 },
});
