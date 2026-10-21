
import {
LONG_SCRIPT,
measuredSeconds,
muscleGroups,
SCRIPTS,
scriptById,
scriptForSeconds,
SHORT_SCRIPT,
type LoosenScript,
} from "../src/scripts";

describe("durations", () => {
it.each(SCRIPTS)("$name runs for exactly its declared length", (script: LoosenScript) => {
expect(measuredSeconds(script)).toBe(script.totalSeconds);
});

it("the short script is five minutes and the long one fifteen", () => {
expect(SHORT_SCRIPT.totalSeconds).toBe(300);
expect(LONG_SCRIPT.totalSeconds).toBe(900);
});

it.each(SCRIPTS)("$name gives every step a positive duration", (script: LoosenScript) => {
for(const step of script.steps){
expect(step.seconds).toBeGreaterThan(0);
}
});

it.each(SCRIPTS)("$name spends longer releasing than tightening", (script: LoosenScript) => {
const tense=script.steps.filter((s) => s.kind === "tense").reduce((n, s) => n + s.seconds, 0);
const release=script.steps
.filter((s) => s.kind === "release")
.reduce((n, s) => n + s.seconds, 0);
expect(release).toBeGreaterThan(tense * 3);
});
});

describe("safety copy", () => {
it.each(SCRIPTS)("$name says to tighten gently rather than maximally", (script: LoosenScript) => {
const intro=script.steps
.filter((s) => s.kind === "intro")
.map((s) => s.say)
.join(" ")
.toLowerCase();
expect(intro).toMatch(/gently|half as hard|half effort/);
expect(intro).not.toMatch(/as hard as you can|as tight as possible|maximum/);
});

it.each(SCRIPTS)("$name says to skip sore areas and stop if it hurts", (script: LoosenScript) => {
const intro=script.steps
.filter((s) => s.kind === "intro")
.map((s) => s.say)
.join(" ")
.toLowerCase();
expect(intro).toMatch(/skip/);
expect(intro).toMatch(/hurt|sore|pain/);
expect(intro).toMatch(/stop/);
});

it.each(SCRIPTS)(
"$name lets neck and shoulders be done without tensing",
(script: LoosenScript) => {
const optional=script.steps.filter((s) => s.tensingOptional);
expect(optional.length).toBeGreaterThan(0);

const groups=new Set(optional.map((s) => s.group));
const names=[...groups].join(" ").toLowerCase();
expect(names).toMatch(/neck|shoulder/);

const spoken=optional
.filter((s) => s.kind === "tense")
.map((s) => s.say)
.join(" ")
.toLowerCase();
expect(spoken).toMatch(/skip|leave them|without/);
expect(spoken).toMatch(/either way works|both are the exercise|that counts/);
},
);

it.each(SCRIPTS)("$name never uses pressure or praise", (script: LoosenScript) => {
const all=script.steps.map((s) => s.say).join(" ");
expect(all).not.toMatch(/!/);
expect(all).not.toMatch(/well done|good job|great|perfect|keep it up|don't give up/i);
expect(all).not.toMatch(/you should|you must|you need to/i);
});

it.each(SCRIPTS)("$name makes no medical claim", (script: LoosenScript) => {
const all=script.steps.map((s) => s.say).join(" ").toLowerCase();
for(const banned of ["cure", "treat", "prevent your migraine", "diagnos", "heal"]){
expect(all).not.toContain(banned);
}
});
});

describe("structure", () => {
it.each(SCRIPTS)("$name opens with an intro and closes with an outro", (script: LoosenScript) => {
expect(script.steps[0]!.kind).toBe("intro");
expect(script.steps[script.steps.length - 1]!.kind).toBe("outro");
});

it.each(SCRIPTS)("$name pairs every tense with a release", (script: LoosenScript) => {
const tense=script.steps.filter((s) => s.kind === "tense");
const release=script.steps.filter((s) => s.kind === "release");
expect(tense).toHaveLength(release.length);

for(let i = 0; i < script.steps.length - 1; i++){
if(script.steps[i]!.kind !== "tense") continue;
const next=script.steps[i + 1]!;
expect(next.kind).toBe("release");
expect(next.group).toBe(script.steps[i]!.group);
}
});

it.each(SCRIPTS)("$name marks every tense and release with a pulse", (script: LoosenScript) => {
for(const step of script.steps){
if(step.kind === "tense") expect(step.haptic).toBe("tense");
if(step.kind === "release") expect(step.haptic).toBe("release");
if(step.kind === "intro" || step.kind === "outro") expect(step.haptic).toBeNull();
}
});

it.each(SCRIPTS)("$name gives every step a unique id", (script: LoosenScript) => {
const ids=script.steps.map((s) => s.id);
expect(new Set(ids).size).toBe(ids.length);
});

it("the short script is genuinely shorter in groups, not just in seconds", () => {
expect(muscleGroups(SHORT_SCRIPT).length).toBeLessThan(muscleGroups(LONG_SCRIPT).length);
expect(muscleGroups(SHORT_SCRIPT).length).toBe(6);
expect(muscleGroups(LONG_SCRIPT).length).toBe(12);
});
});

describe("lookup", () => {
it("finds a script by id", () => {
expect(scriptById("short-5")).toBe(SHORT_SCRIPT);
expect(scriptById("long-15")).toBe(LONG_SCRIPT);
expect(scriptById("nope")).toBeNull();
});

it("picks the long script only at or above its length", () => {
expect(scriptForSeconds(300)).toBe(SHORT_SCRIPT);
expect(scriptForSeconds(899)).toBe(SHORT_SCRIPT);
expect(scriptForSeconds(900)).toBe(LONG_SCRIPT);
});
});
