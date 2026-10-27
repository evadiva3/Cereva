
import { memo, useCallback, useRef } from "react";
import {
AccessibilityInfo,
Pressable,
StyleSheet,
Switch,
Text,
View,
} from "react-native";
import * as Haptics from "expo-haptics";

import type { FieldSpec, LeafSpec } from "@aura/schema";
import { colors, radius, space, touch, type as typeScale } from "@/theme";

const SLIDER_STEPS=40;

function stepFor(spec: { min: number; max: number; int?: boolean | undefined }): number {
const raw=(spec.max - spec.min) / SLIDER_STEPS;
if(spec.int) return Math.max(1, Math.round(raw));
const magnitude=Math.pow(10, Math.floor(Math.log10(raw)));
return Math.max(magnitude, Math.round(raw / magnitude) * magnitude);
}

function formatValue(spec: { int?: boolean | undefined; unit?: string | undefined }, v: number): string {
const n=spec.int ? String(Math.round(v)) : String(Math.round(v * 1000) / 1000);
return spec.unit ? `${n} ${spec.unit}` : n;
}

interface RowProps {
label: string;
hint?: string | undefined;
children: React.ReactNode;
}

function Row({ label, hint, children }: RowProps){
return (
<View style={styles.row}>
<View style={styles.rowHeader}>
<Text style={styles.label} maxFontSizeMultiplier={2.5}>
{label}
</Text>
{hint ? (
<Text style={styles.hint} maxFontSizeMultiplier={2.5}>
{hint}
</Text>
) : null}
</View>
{children}
</View>
);
}

interface NumberControlProps {
spec: Extract<LeafSpec, { kind: "number" }>;
value: number;
onChange: (v: number) => void;
}

const NumberControl=memo(function NumberControl({ spec, value, onChange }: NumberControlProps){
const track=useRef<View>(null);
const geometry=useRef({ x:0, width:1 });
const step=stepFor(spec);
const clamp=(v: number) => Math.min(spec.max, Math.max(spec.min, v));
const fraction=(value - spec.min) / (spec.max - spec.min || 1);

const nudge=useCallback(
(direction: 1 | -1) => {
const next=clamp(spec.int ? Math.round(value + step * direction) : value + step * direction);
if(next === value) return;
void Haptics.selectionAsync();
onChange(next);
},
[value, step, spec, onChange],
);

const label=`${spec.label}, ${formatValue(spec, value)}`;
const drag=(pageX: number) => {
const fraction=Math.min(1,Math.max(0,(pageX-geometry.current.x)/geometry.current.width));
const raw=spec.min+fraction*(spec.max-spec.min);
onChange(spec.int ? Math.round(raw) : Math.round(raw*1000)/1000);
};

return (
<Row label={spec.label} hint={spec.hint}>
<View style={styles.sliderRow}>
<View ref={track}
style={styles.track}
onStartShouldSetResponder={() => true}
onMoveShouldSetResponder={() => true}
onResponderGrant={event => { const x=event.nativeEvent.pageX; track.current?.measureInWindow((left,_top,width) => { geometry.current={x:left,width:Math.max(1,width)}; drag(x); }); }}
onResponderMove={event => drag(event.nativeEvent.pageX)}
accessible
accessibilityRole="adjustable"
accessibilityLabel={label}
accessibilityValue={{
min: spec.min,
max: spec.max,
now: value,
text: formatValue(spec, value),
}}
accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
onAccessibilityAction={(e) => {
nudge(e.nativeEvent.actionName === "increment" ? 1 : -1);
}}
>
<View pointerEvents="none" style={styles.rail} />
<View pointerEvents="none" style={[styles.trackFill, { width: `${Math.round(fraction * 100)}%` }]} />
<View
style={[styles.thumb, { left: `${Math.round(fraction * 100)}%` }]}
pointerEvents="none"
/>
</View>


</View>
<Text style={styles.value} maxFontSizeMultiplier={2}>
{formatValue(spec, value)}
</Text>
</Row>
);
});

interface BoolControlProps {
spec: Extract<LeafSpec, { kind: "bool" }>;
value: boolean;
onChange: (v: boolean) => void;
}

const BoolControl=memo(function BoolControl({ spec, value, onChange }: BoolControlProps){
return (
<View style={styles.switchRow}>
<View style={styles.rowHeader}>
<Text style={styles.label} maxFontSizeMultiplier={2.5}>
{spec.label}
</Text>
{spec.hint ? (
<Text style={styles.hint} maxFontSizeMultiplier={2.5}>
{spec.hint}
</Text>
) : null}
</View>
<Switch
value={value}
onValueChange={(v) => {
void Haptics.selectionAsync();
onChange(v);
}}
accessibilityLabel={spec.label}
trackColor={{ false: colors.line, true: colors.accentDim }}
thumbColor={value ? colors.accent : colors.textFaint}
ios_backgroundColor={colors.line}
/>
</View>
);
});

interface EnumControlProps {
spec: Extract<LeafSpec, { kind: "enum" }>;
value: string;
onChange: (v: string) => void;
}

function optionLabel(v: string): string {
const s=v.replace(/_/g, " ");
return s.charAt(0).toUpperCase() + s.slice(1);
}

const EnumControl=memo(function EnumControl({ spec, value, onChange }: EnumControlProps){
return (
<Row label={spec.label} hint={spec.hint}>
<View style={styles.segments}>
{spec.values.map((v) => {
const sel=v === value;
return (
<Pressable
key={v}
onPress={() => {
if(sel) return;
void Haptics.selectionAsync();
onChange(v);
}}
style={({ pressed }) => [
styles.segment,
sel && styles.segmentSelected,
pressed && styles.segmentPressed,
]}
accessibilityRole="radio"
accessibilityState={{ selected: sel }}
accessibilityLabel={`${spec.label}, ${optionLabel(v)}`}
>
<Text
style={[styles.segmentText, sel && styles.segmentTextSelected]}
maxFontSizeMultiplier={2}
>
{optionLabel(v)}
</Text>
</Pressable>
);
})}
</View>
</Row>
);
});

const SWATCHES=[
"#ffffff",
"#ffd700",
"#a0c0ff",
"#c9c2ec",
"#9d9ddd",
"#8a8a8a",
"#2a2a2a",
"#12080e",
"#0a0510",
];

interface ColorControlProps {
spec: Extract<LeafSpec, { kind: "color" }>;
value: string;
onChange: (v: string) => void;
}

const ColorControl=memo(function ColorControl({ spec, value, onChange }: ColorControlProps){
const opts=SWATCHES.includes(value.toLowerCase()) ? SWATCHES : [value, ...SWATCHES];
return (
<Row label={spec.label} hint={spec.hint}>
<View style={styles.swatches}>
{opts.map((hex) => {
const sel=hex.toLowerCase() === value.toLowerCase();
return (
<Pressable
key={hex}
onPress={() => {
if(sel) return;
void Haptics.selectionAsync();
onChange(hex);
}}
style={[styles.swatch, { backgroundColor: hex }, sel && styles.swatchSelected]}
accessibilityRole="radio"
accessibilityState={{ selected: sel }}
accessibilityLabel={`${spec.label}, ${hex}`}
/>
);
})}
</View>
</Row>
);
});

export interface FieldControlProps {
field: string;
spec: FieldSpec;
value: unknown;
onChange: (field: string, value: unknown) => void;
}

export const FieldControl=memo(function FieldControl({
field,
spec,
value,
onChange,
}: FieldControlProps){
const set=useCallback((v: unknown) => onChange(field, v), [field, onChange]);

switch(spec.kind){
case "number":
return <NumberControl spec={spec} value={value as number} onChange={set} />;
case "bool":
return <BoolControl spec={spec} value={value as boolean} onChange={set} />;
case "enum":
return <EnumControl spec={spec} value={value as string} onChange={set} />;
case "color":
return <ColorControl spec={spec} value={value as string} onChange={set} />;
case "list":
case "polylines":
return null;
}
});

export function announce(message: string): void {
AccessibilityInfo.announceForAccessibility(message);
}

const styles=StyleSheet.create({
row: {
paddingVertical: space.md,
paddingHorizontal: space.lg,
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},
rowHeader: { flex: 1, gap: 2 },
label: { color: colors.text, fontSize: typeScale.body },
hint: { color: colors.textFaint, fontSize: typeScale.caption },
value: {
color: colors.textMuted,
fontSize: typeScale.caption,
marginTop: space.xs,
textAlign: "right",
},

sliderRow: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
marginTop: space.sm,
},
nudge: {
width: touch.min,
height: touch.min,
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
alignItems: "center",
justifyContent: "center",
},
nudgePressed: { backgroundColor: colors.lineStrong },
nudgeDisabled: { opacity: 0.35 },
nudgeGlyph: { color: colors.text, fontSize: typeScale.title, lineHeight: typeScale.title + 4 },

track: {
flex: 1,
height: 44,
justifyContent: "center",
},
rail: { position: "absolute", left: 0, right: 0, height: 8, borderRadius: radius.pill, backgroundColor: colors.line },
trackFill: {
position: "absolute",
left: 0,
height: 8,
borderRadius: radius.pill,
backgroundColor: colors.accentDim,
},
thumb: {
position: "absolute",
width: 18,
height: 18,
marginLeft: -9,
borderRadius: 9,
backgroundColor: colors.accent,
},

switchRow: {
flexDirection: "row",
alignItems: "center",
gap: space.md,
minHeight: touch.comfortable,
paddingVertical: space.sm,
paddingHorizontal: space.lg,
borderBottomWidth: StyleSheet.hairlineWidth,
borderBottomColor: colors.line,
},

segments: {
flexDirection: "row",
flexWrap: "wrap",
gap: space.sm,
marginTop: space.sm,
},
segment: {
minHeight: touch.min,
justifyContent: "center",
paddingHorizontal: space.lg,
borderRadius: radius.md,
backgroundColor: colors.surfaceRaised,
borderWidth: 1,
borderColor: "transparent",
},
segmentSelected: { borderColor: colors.accent, backgroundColor: colors.surface },
segmentPressed: { opacity: 0.7 },
segmentText: { color: colors.textMuted, fontSize: typeScale.label },
segmentTextSelected: { color: colors.text },

swatches: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
swatch: {
width: touch.min,
height: touch.min,
borderRadius: radius.md,
borderWidth: 2,
borderColor: colors.line,
},
swatchSelected: { borderColor: colors.accent, borderWidth: 3 },
});
