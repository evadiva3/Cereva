export type Practice="meditation" | "breathing";
export type Cue={ title: string; text: string };
const MEDITATION: readonly Cue[]=[
{ title: "Settle", text: "Sit or lie down however you want. Close your eyes if that helps." },
{ title: "Breath", text: "Let your breath do what it does. You do not have to change it." },
{ title: "Sound", text: "Pick out a sound close by. Then one further away." },
{ title: "Wandering", text: "Your mind will wander. That is normal. Come back to the breath." },
{ title: "Shoulders", text: "Check your shoulders and your hands. Let them drop." },
{ title: "Finish", text: "Feel the room again. Open your eyes when you want to." },
];
export function practiceDuration(raw: string | undefined){
const seconds=Number(raw);
return [120,180,300,600].includes(seconds) ? seconds : 180;
}
export function practiceCue(kind: Practice, elapsed: number, duration: number): Cue & { index: number; remaining: number; inhale: boolean }{
const time=Math.max(0,Math.min(elapsed,duration));
if(kind === "breathing"){
const phase=time%10;
const inhale=phase<4;
return { title: inhale ? "Breathe in" : "Breathe out", text: "Slow and steady. Your pace, not the circle's.", index: Math.floor(time/10)*2+(inhale ? 0 : 1), remaining: inhale ? 4-phase : 10-phase, inhale };
}
const span=duration/MEDITATION.length;
const index=Math.min(MEDITATION.length-1,Math.floor(time/span));
return { ...MEDITATION[index]!, index, remaining: span-(time%span), inhale:false };
}
