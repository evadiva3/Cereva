
export type StepKind = "intro" | "tense" | "release" | "settle" | "outro";

export interface ScriptStep {
id: string;
kind: StepKind;
group: string | null;
say: string;
seconds: number;
haptic: "tense" | "release" | null;
tensingOptional?: boolean;
}

export interface LoosenScript {
id: string;
name: string;
totalSeconds: number;
steps: ScriptStep[];
}

const SAFETY_INTRO: ScriptStep[]=[
{
id: "intro-settle",
kind: "intro",
group: null,
say: "Find a position you can hold without effort. Sitting or lying down both work.",
seconds: 9,
haptic: null,
},
{
id: "intro-method",
kind: "intro",
group: null,
say: "We will go through a few muscle groups. You will tighten each one, hold it a moment, then let it go and notice the difference.",
seconds: 10,
haptic: null,
},
{
id: "intro-gentle",
kind: "intro",
group: null,
say: "Tighten gently, about half as hard as you could. Straining works against this, and hard clenching can bring a headache on rather than settle one.",
seconds: 11,
haptic: null,
},
{
id: "intro-safety",
kind: "intro",
group: null,
say: "Skip any area that is already sore. If anything starts to hurt, stop that part and let it rest. There is no benefit in pushing through.",
seconds: 11,
haptic: null,
},
{
id: "intro-eyes",
kind: "intro",
group: null,
say: "You can close your eyes. A short buzz marks each tighten, and a longer one marks each release.",
seconds: 10,
haptic: null,
},
];

const OUTRO: ScriptStep[]=[
{
id: "outro-still",
kind: "outro",
group: null,
say: "Stay still for a moment longer.",
seconds: 7,
haptic: null,
},
{
id: "outro-notice",
kind: "outro",
group: null,
say: "Notice how your body feels now, compared with when you started. Whatever you find is fine. Nothing has to have changed.",
seconds: 13,
haptic: null,
},
{
id: "outro-return",
kind: "outro",
group: null,
say: "When you are ready, let your eyes open and move slowly for a minute.",
seconds: 11,
haptic: null,
},
];

function pair(
id: string,
group: string,
tenseText: string,
releaseText: string,
tenseSeconds: number,
releaseSeconds: number,
tensingOptional=false,
): ScriptStep[] {
return [
{
id: `${id}-tense`,
kind: "tense",
group,
say: tenseText,
seconds: tenseSeconds,
haptic: "tense",
...(tensingOptional ? { tensingOptional: true } : {}),
},
{
id: `${id}-release`,
kind: "release",
group,
say: releaseText,
seconds: releaseSeconds,
haptic: "release",
...(tensingOptional ? { tensingOptional: true } : {}),
},
];
}

const RELEASE_TEXTS={
hands: "Let go. Let your hands fall open and stay with the feeling in your fingers as it fades.",
arms: "Let go. Let the weight of your arms rest on whatever is underneath them.",
face: "Let go. Let your forehead smooth out and your jaw hang slightly open.",
neck: "Let go. Let your head settle where it wants to sit, without holding it.",
torso: "Let go. Let your breathing find its own pace again.",
legs: "Let go. Let your legs be heavy and still.",
} as const;

export const SHORT_SCRIPT: LoosenScript={
id: "short-5",
name: "Five minutes",
totalSeconds: 300,
steps: [
...SAFETY_INTRO,
...pair(
"hands",
"Hands",
"Close both hands into a loose fist. Gently, about half effort. Hold.",
RELEASE_TEXTS.hands,
6,
30,
),
...pair(
"arms",
"Arms",
"Draw your forearms up towards your shoulders, just enough to feel it. Hold.",
RELEASE_TEXTS.arms,
6,
30,
),
...pair(
"face",
"Face and jaw",
"Close your eyes a little more firmly and press your lips together. Keep your teeth apart. Hold.",
RELEASE_TEXTS.face,
6,
30,
),
...pair(
"neck",
"Neck and shoulders",
"Lift your shoulders a small way towards your ears. If your neck or shoulders are sore today, skip the lifting entirely and simply rest your attention there. Either way works.",
RELEASE_TEXTS.neck,
8,
30,
true,
),
...pair(
"torso",
"Stomach",
"Firm your stomach gently, as if bracing lightly. Keep breathing. Hold.",
RELEASE_TEXTS.torso,
6,
30,
),
...pair(
"legs",
"Legs and feet",
"Press your heels down and point your toes gently upward. Hold.",
RELEASE_TEXTS.legs,
6,
30,
),
...OUTRO,
],
};

export const LONG_SCRIPT: LoosenScript={
id: "long-15",
name: "Fifteen minutes",
totalSeconds: 900,
steps: [
...SAFETY_INTRO,
{
id: "intro-long",
kind: "intro",
group: null,
say: "This one is longer, so there is no need to hurry any part of it.",
seconds: 8,
haptic: null,
},
...pair("hands", "Hands", "Close both hands into a loose fist. Gently. Hold.", RELEASE_TEXTS.hands, 7, 54),
...pair(
"forearms",
"Forearms",
"Bend your wrists back so your fingers lift towards you. Gently. Hold.",
"Let go. Let your wrists fall slack.",
7,
54,
),
...pair(
"upperarms",
"Upper arms",
"Draw your forearms up towards your shoulders. Hold.",
RELEASE_TEXTS.arms,
7,
54,
),
{
id: "settle-1",
kind: "settle",
group: null,
say: "Rest here a moment before moving on.",
seconds: 20,
haptic: null,
},
...pair(
"forehead",
"Forehead",
"Raise your eyebrows a little, as if mildly surprised. Hold.",
"Let go. Let your forehead smooth out.",
7,
54,
),
...pair(
"eyes",
"Eyes",
"Close your eyes a little more firmly. If light is bothering you today, keep this very light. Hold.",
"Let go. Let your eyelids rest closed without pressing.",
7,
54,
),
...pair(
"jaw",
"Jaw",
"Press your lips together gently and keep your teeth apart. Hold.",
RELEASE_TEXTS.face,
7,
54,
),
...pair(
"neck",
"Neck",
"Tilt your chin very slightly down and feel the back of your neck lengthen. If your neck is sore today, skip the movement and rest your attention there instead. Both are the exercise.",
RELEASE_TEXTS.neck,
9,
54,
true,
),
...pair(
"shoulders",
"Shoulders",
"Lift your shoulders a small way towards your ears. If they are already aching, leave them where they are and simply notice them. That counts.",
"Let go. Let your shoulders drop and stay dropped.",
9,
54,
true,
),
{
id: "settle-2",
kind: "settle",
group: null,
say: "Rest again. Nothing to do here.",
seconds: 20,
haptic: null,
},
...pair(
"chest",
"Chest and back",
"Take a slightly fuller breath in and hold it gently.",
"Let it out slowly, and let your shoulders fall with it.",
7,
54,
),
...pair("stomach", "Stomach", "Firm your stomach gently. Keep breathing. Hold.", RELEASE_TEXTS.torso, 7, 54),
...pair(
"thighs",
"Thighs",
"Press your thighs gently together, or press your knees down. Hold.",
"Let go. Let your legs settle apart.",
7,
54,
),
...pair(
"calves",
"Calves and feet",
"Point your toes gently upward towards you. Hold.",
RELEASE_TEXTS.legs,
7,
54,
),
{
id: "settle-3",
kind: "settle",
group: null,
say: "Let everything stay where it is for a while.",
seconds: 34,
haptic: null,
},
...OUTRO,
],
};

export const SCRIPTS: readonly LoosenScript[]=[SHORT_SCRIPT, LONG_SCRIPT];

export function scriptById(id: string): LoosenScript | null {
return SCRIPTS.find((s) => s.id === id) ?? null;
}

export function scriptForSeconds(seconds: number): LoosenScript {
return seconds >= LONG_SCRIPT.totalSeconds ? LONG_SCRIPT : SHORT_SCRIPT;
}

export function measuredSeconds(script: LoosenScript): number {
return script.steps.reduce((total, step) => total + step.seconds, 0);
}

export function muscleGroups(script: LoosenScript): string[] {
const seen: string[]=[];
for(const step of script.steps){
if(step.group && !seen.includes(step.group)) seen.push(step.group);
}
return seen;
}
