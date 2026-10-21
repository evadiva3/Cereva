
import { useCallback, useEffect, useState } from "react";
import {
Alert,
FlatList,
Image,
Pressable,
StyleSheet,
Text,
View,
} from "react-native";
import { router } from "expo-router";

import { LAYER_LABELS } from "@aura/schema";
import { deleteFileQuietly } from "@/files";
import {
deleteAuraVersion,
listAuraVersions,
type AuraVersion,
} from "@/db/auraVersions";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

export default function VersionsScreen(){
const [versions, setVersions]=useState<AuraVersion[] | null>(null);
const [selected, setSelected]=useState<string[]>([]);

const reload=useCallback(() => {
listAuraVersions()
.then(setVersions)
.catch(() => setVersions([]));
}, []);

useEffect(reload, [reload]);

const toggleSelect=useCallback((id: string) => {
setSelected((prev) => {
if(prev.includes(id)) return prev.filter((x) => x !== id);
if(prev.length >= 2) return [prev[1]!, id];
return [...prev, id];
});
}, []);

const confirmDelete=useCallback(
(version: AuraVersion) => {
Alert.alert(
"Delete this version",
`"${version.name}" and its image will be removed. This cannot be undone.`,
[
{ text: "Keep", style: "cancel" },
{
text: "Delete",
style: "destructive",
onPress: () => {
void (async () => {
const path=await deleteAuraVersion(version.id);
deleteFileQuietly(path);
setSelected((prev) => prev.filter((x) => x !== version.id));
reload();
})();
},
},
],
);
},
[reload],
);

if(versions === null){
return (
<View style={styles.center}>
<Text style={styles.muted}>Loading</Text>
</View>
);
}

if(versions.length === 0){
return (
<View style={styles.center}>
<Text style={styles.emptyTitle}>No saved versions yet</Text>
<Text style={styles.muted}>
Build an aura and save it. Saving again later builds the record of how
it changes.
</Text>
</View>
);
}

return (
<View style={styles.root}>
<FlatList
data={versions}
keyExtractor={(v) => v.id}
contentContainerStyle={styles.list}
renderItem={({ item }) => {
const isSelected=selected.includes(item.id);
const layerNames=item.state.layers
.filter((l) => l.visible)
.map((l) => LAYER_LABELS[l.type])
.join(", ");
return (
<Pressable
style={[styles.card, isSelected && styles.cardSelected]}
onPress={() => toggleSelect(item.id)}
onLongPress={() => confirmDelete(item)}
accessibilityRole="checkbox"
accessibilityState={{ checked: isSelected }}
accessibilityLabel={
`${item.name}, saved ${new Date(item.createdAt).toLocaleString()}. ` +
`${item.state.layers.length} layers: ${layerNames || "none shown"}. ` +
`Tap to select for comparison, long press to delete.`
}
>
{item.thumbnailPath ? (
<Image
source={{ uri: item.thumbnailPath }}
style={styles.thumb}
accessibilityIgnoresInvertColors
/>
) : (
<View style={[styles.thumb, styles.thumbMissing]} />
)}
<View style={styles.cardBody}>
<Text style={styles.cardTitle} maxFontSizeMultiplier={2}>
{item.name}
</Text>
<Text style={styles.cardMeta} maxFontSizeMultiplier={2}>
{new Date(item.createdAt).toLocaleString()}
</Text>
<Text style={styles.cardLayers} numberOfLines={2} maxFontSizeMultiplier={2}>
{layerNames || "No layers shown"}
</Text>
{item.provenance ? (
<Text style={styles.cardProvenance} maxFontSizeMultiplier={2}>
Started from a description
</Text>
) : null}
{item.loadWarnings.length > 0 ? (
<Text style={styles.cardWarning} maxFontSizeMultiplier={2}>
Saved by a different version of the app, adjusted on load
</Text>
) : null}
</View>
</Pressable>
);
}}
/>

<View style={styles.footer}>
<Text style={styles.footerHint} maxFontSizeMultiplier={1.8}>
{selected.length === 0
? "Select two to compare"
: selected.length === 1
? "Select one more"
: "Two selected"}
</Text>
<Pressable
style={[styles.compareButton, selected.length !== 2 && styles.compareDisabled]}
disabled={selected.length !== 2}
onPress={() =>
router.push({
pathname: "/compare",
params: { a: selected[0]!, b: selected[1]! },
})
}
accessibilityRole="button"
accessibilityLabel="Compare the two selected versions"
accessibilityState={{ disabled: selected.length !== 2 }}
>
<Text style={styles.compareText} maxFontSizeMultiplier={1.8}>
Compare
</Text>
</Pressable>
</View>
</View>
);
}

const styles=StyleSheet.create({
root: { flex: 1, backgroundColor: colors.canvas },
center: {
flex: 1,
backgroundColor: colors.canvas,
alignItems: "center",
justifyContent: "center",
padding: space.xl,
gap: space.md,
},
emptyTitle: { color: colors.text, fontSize: typeScale.title, textAlign: "center" },
muted: { color: colors.textMuted, fontSize: typeScale.body, textAlign: "center" },

list: { padding: space.md, gap: space.md },
card: {
flexDirection: "row",
gap: space.md,
padding: space.md,
borderRadius: radius.lg,
backgroundColor: colors.surface,
borderWidth: 2,
borderColor: "transparent",
},
cardSelected: { borderColor: colors.accent },
thumb: { width: 84, height: 108, borderRadius: radius.md, backgroundColor: colors.canvas },
thumbMissing: { borderWidth: 1, borderColor: colors.line },
cardBody: { flex: 1, gap: 2 },
cardTitle: { color: colors.text, fontSize: typeScale.body },
cardMeta: { color: colors.textFaint, fontSize: typeScale.caption },
cardLayers: { color: colors.textMuted, fontSize: typeScale.caption, marginTop: space.xs },
cardProvenance: { color: colors.accentDim, fontSize: typeScale.caption },
cardWarning: { color: colors.warn, fontSize: typeScale.caption },

footer: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
padding: space.md,
borderTopWidth: StyleSheet.hairlineWidth,
borderTopColor: colors.line,
},
footerHint: { flex: 1, color: colors.textMuted, fontSize: typeScale.label },
compareButton: {
minHeight: touch.comfortable,
justifyContent: "center",
paddingHorizontal: space.xl,
borderRadius: radius.md,
backgroundColor: colors.accent,
},
compareDisabled: { opacity: 0.4 },
compareText: { color: colors.accentText, fontSize: typeScale.label },
});
