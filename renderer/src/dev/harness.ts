
import {
ALL_LAYERS_STRESS_INPUT,
AURA_PRESETS,
HEAVY_REALISTIC_INPUT,
envelope,
type HostMessage,
} from "../../../packages/aura-schema/src/index";

interface Captured {
v: number;
id: string;
replyTo?: string;
body: { type: string; [k: string]: unknown };
}

const captured: Captured[]=[];

window.ReactNativeWebView={
postMessage(data: string){
try {
captured.push(JSON.parse(data) as Captured);
}catch {
captured.push({ v: -1, id: "unparseable", body: { type: "unparseable", data } });
}
},
};

let seq=0;
function send(body: HostMessage): void {
window.scintilla?.send(envelope(`h${++seq}`, body));
}

interface Harness {
messages(): Captured[];
of(type: string): Captured[];
send(body: HostMessage): void;
preset(id: string): string[];
stress(): void;
heavy(): void;
measure(seconds: number): Promise<unknown>;
presetIds(): string[];
}

const harness: Harness={
messages: () => captured,
of: (type) => captured.filter((m) => m.body.type === type),
send,
preset(id){
const p=AURA_PRESETS.find((x) => x.id === id);
if(!p) return AURA_PRESETS.map((x) => x.id);
send({ type: "setState", state: { schemaVersion: 1, ...p.input } });
return [p.id];
},
stress(){
send({ type: "setState", state: { schemaVersion: 1, ...ALL_LAYERS_STRESS_INPUT } });
},
heavy(){
send({ type: "setState", state: { schemaVersion: 1, ...HEAVY_REALISTIC_INPUT } });
},
async measure(seconds){
send({ type: "resetStats" });
await new Promise((r) => setTimeout(r, seconds * 1000));
send({ type: "requestStats" });
const stats=captured.filter((m) => m.body.type === "stats");
return stats[stats.length - 1]?.body.stats ?? null;
},
presetIds: () => AURA_PRESETS.map((p) => p.id),
};

(window as unknown as { harness: Harness }).harness = harness;

async function autoDrive(): Promise<void> {
for(let i = 0; i < 200 && !window.scintilla; i++){
await new Promise((r) => setTimeout(r, 10));
}
if(!window.scintilla){
console.error("[harness] the engine never booted");
return;
}

const q=new URLSearchParams(location.search);
const presetId=q.get("preset");

if(q.has("stress")) harness.stress();
else if(q.has("heavy")) harness.heavy();
else if(presetId) harness.preset(presetId);

const bg=q.get("bg");
if(bg) send({ type: "setBackground", background: { background_type: bg, photo_uri: null } });

if(q.get("dof") === "0") send({ type: "setQuality", depthOfField: false });

const dpr=q.get("maxdpr");
if(dpr) send({ type: "setQuality", maxDpr: Number(dpr) });

send({ type: "setMotion", pointer: { x: 220, y: 300 } });
}

void import("../main").then(autoDrive);
