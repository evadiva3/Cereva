
import * as Speech from "expo-speech";

export interface Narrator {
say(text: string, stepId: string): Promise<void>;
stop(): void;
isAudible(): boolean;
}

export class SpeechNarrator implements Narrator {
private available = true;

constructor(private readonly rate = 0.78, private readonly pitch = 0.95) {}

say(text: string, _stepId: string): Promise<void> {
if(!this.available) return Promise.resolve();
return new Promise<void>((resolve) => {
let settled=false;
const finish=() => {
if(settled) return;
settled=true;
resolve();
};
try {
Speech.speak(text, {
rate: this.rate,
pitch: this.pitch,
onDone: finish,
onStopped: finish,
onError: () => {
this.available=false;
finish();
},
});
}catch {
this.available=false;
finish();
}
});
}

stop(): void {
try {
Speech.stop();
}catch {}
}

isAudible(): boolean {
return this.available;
}
}

export class SilentNarrator implements Narrator {
say(): Promise<void> {
return Promise.resolve();
}
stop(): void {}
isAudible(): boolean {
return false;
}
}

export async function speechAvailable(): Promise<boolean> {
try {
const voices=await Speech.getAvailableVoicesAsync();
return Array.isArray(voices) && voices.length > 0;
}catch {
return false;
}
}

export async function makeNarrator(enabled: boolean): Promise<Narrator> {
if(!enabled) return new SilentNarrator();
return (await speechAvailable()) ? new SpeechNarrator() : new SilentNarrator();
}

export const SCREEN_LOCK_NOTE =
"The screen stays on and dimmed during a session. Spoken guidance stops if " +
"the phone locks, so this is the workaround until recorded audio is added.";
