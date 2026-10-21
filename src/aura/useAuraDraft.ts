
import { useCallback, useMemo, useRef, useState } from "react";

import {
AURA_PRESETS,
DEFAULT_CONFIGS,
LAYER_LABELS,
emptyAuraState,
inCanonicalOrder,
normalizeAuraState,
type AuraState,
type BackgroundConfig,
type LayerType,
type SymptomLayer,
type Warning,
} from "@aura/schema";

export interface AuraDraft {
state: AuraState;
dirty: boolean;
warnings: Warning[];

addLayer(type: LayerType): void;
removeLayer(type: LayerType): void;
toggleLayer(type: LayerType): void;
setLayerOpacity(type: LayerType, opacity: number): void;
setLayerField(type: LayerType, field: string, value: unknown): void;
moveLayer(type: LayerType, direction: -1 | 1): void;
setBackground(background: BackgroundConfig): void;
loadPreset(presetId: string): void;
load(state: AuraState): void;
reset(): void;
markSaved(): void;
}

export function useAuraDraft(initial?: AuraState): AuraDraft {
const [state, setState]=useState<AuraState>(() =>
initial ? normalizeAuraState(initial).state : emptyAuraState(),
);
const [warnings, setWarnings]=useState<Warning[]>([]);
const [dirty, setDirty]=useState(false);
const stateRef=useRef(state);
stateRef.current=state;

const commit=useCallback((next: AuraState, markDirty=true) => {
const res=normalizeAuraState(next);
setState(res.state);
setWarnings(res.warnings);
if(markDirty) setDirty(true);
}, []);

const mapLayers=useCallback(
(fn: (layers: SymptomLayer[]) => SymptomLayer[]) => {
const current=stateRef.current;
commit({ ...current, layers: fn(current.layers) });
},
[commit],
);

const addLayer=useCallback(
(type: LayerType) => {
mapLayers((layers) => {
if(layers.some((l) => l.type === type)) return layers;
const layer={
id: type,
type,
visible: true,
opacity: 1,
config: structuredClone(DEFAULT_CONFIGS[type]),
} as SymptomLayer;
return inCanonicalOrder([...layers, layer]);
});
},
[mapLayers],
);

const removeLayer=useCallback(
(type: LayerType) => mapLayers((layers) => layers.filter((l) => l.type !== type)),
[mapLayers],
);

const toggleLayer=useCallback(
(type: LayerType) =>
mapLayers((layers) =>
layers.map((l) => (l.type === type ? { ...l, visible: !l.visible } : l)),
),
[mapLayers],
);

const setLayerOpacity=useCallback(
(type: LayerType, opacity: number) =>
mapLayers((layers) =>
layers.map((l) => (l.type === type ? { ...l, opacity } : l)),
),
[mapLayers],
);

const setLayerField=useCallback(
(type: LayerType, field: string, value: unknown) =>
mapLayers((layers) =>
layers.map((l) =>
l.type === type
? ({ ...l, config: { ...l.config, [field]: value } } as SymptomLayer)
: l,
),
),
[mapLayers],
);

const moveLayer=useCallback(
(type: LayerType, direction: -1 | 1) =>
mapLayers((layers) => {
const i=layers.findIndex((l) => l.type === type);
const j=i + direction;
if(i < 0 || j < 0 || j >= layers.length) return layers;
const next=[...layers];
const a=next[i]!;
const b=next[j]!;
next[i]=b;
next[j]=a;
return next;
}),
[mapLayers],
);

const setBackground=useCallback(
(background: BackgroundConfig) => commit({ ...stateRef.current, background }),
[commit],
);

const loadPreset=useCallback(
(presetId: string) => {
const preset=AURA_PRESETS.find((p) => p.id === presetId);
if(!preset) return;
const res=normalizeAuraState({ schemaVersion: 1, ...preset.input });
commit({
schemaVersion: res.state.schemaVersion,
layers: inCanonicalOrder(res.state.layers),
background: stateRef.current.background,
});
},
[commit],
);

const load=useCallback(
(next: AuraState) => {
commit(next, false);
setDirty(false);
},
[commit],
);

const reset=useCallback(() => {
commit(emptyAuraState(), false);
setDirty(false);
}, [commit]);

const markSaved=useCallback(() => setDirty(false), []);

return useMemo(
() => ({
state,
dirty,
warnings,
addLayer,
removeLayer,
toggleLayer,
setLayerOpacity,
setLayerField,
moveLayer,
setBackground,
loadPreset,
load,
reset,
markSaved,
}),
[
state,
dirty,
warnings,
addLayer,
removeLayer,
toggleLayer,
setLayerOpacity,
setLayerField,
moveLayer,
setBackground,
loadPreset,
load,
reset,
markSaved,
],
);
}

export function availableLayers(state: AuraState): { type: LayerType; label: string }[] {
const present=new Set(state.layers.map((l) => l.type));
return (Object.keys(LAYER_LABELS) as LayerType[])
.filter((t) => !present.has(t))
.map((t) => ({ type: t, label: LAYER_LABELS[t] }));
}
