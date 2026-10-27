import { runEngine, THRESHOLDS } from "../src/engine";
import type { DayRecord } from "../src/types";

function rng(seed: number){
let t=seed >>> 0;
return () => {
t=(t + 0x6d2b79f5) >>> 0;
let x=Math.imul(t ^ (t >>> 15), 1 | t);
x=(x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
}

function dateAt(i: number){
const d=new Date(Date.UTC(2025, 0, 1));
d.setUTCDate(d.getUTCDate() + i);
return d.toISOString().slice(0, 10);
}

function normal(rand: () => number, mean: number, sd: number){
const u=Math.max(1e-9, rand());
const v=rand();
return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function demo(days=180, seed=23): DayRecord[] {
const rand=rng(seed);
const sleep: number[]=[];
const pressureHpa: number[]=[];
for(let i = 0; i < days; i++){
sleep.push(Math.max(220, Math.min(620, normal(rand, 425, 75))));
pressureHpa.push(normal(rand, 0, 4.5));
}

const out: DayRecord[]=[];
let severity=1;

for(let i = 0; i < days; i++){
const shortLastNight=i > 0 && sleep[i - 1]! < 360;
const bigDrop=pressureHpa[i]! < -5;
const skippedMeal=rand() < 0.28;
const alcohol=rand() < 0.2;
const caffeineChange=rand() < 0.18;
const stressRoll=rand();
const stress=stressRoll < 0.28 ? 2 : stressRoll < 0.5 ? 1 : 0;

let p=0.08;
if(shortLastNight) p += 0.5;
if(bigDrop) p += 0.28;
if(stress === 2) p += 0.12;

if(rand() < p && severity < 3) severity += 1;
else if(rand() < 0.4 && severity > 1) severity -= 1;

out.push({
date: dateAt(i),
logged: true,
attack: severity >= 1,
severity,
alcohol,
caffeineChange,
skippedMeal,
stress,
sleepMinutes: sleep[i]!,
steps: normal(rand, 6200, 2200),
menstruating: null,
pressureChange: pressureHpa[i]!,
tempChange: normal(rand, 0, 2.5),
humidity: normal(rand, 62, 12),
loosenSession: false,
});
}
return out;
}

describe("the demo dataset", () => {
const days=demo();
const out=runEngine(days);

it("is long enough to clear the logging threshold", () => {
expect(days.length).toBeGreaterThanOrEqual(THRESHOLDS.minLoggedDays);
expect(out.overallReason).not.toBe("too_few_days");
});

it("reads as chronic rather than episodic", () => {
expect(out.attackDayFraction).toBeGreaterThanOrEqual(THRESHOLDS.continuousAttackFraction);
expect(out.mode).toBe("continuous");
});

it("has enough days it got worse to analyse", () => {
expect(out.onsets).toBeGreaterThanOrEqual(THRESHOLDS.minWorsenings);
});

it("actually reports something, which is the point of a demo", () => {
expect(out.overallReason).toBeNull();
expect(out.factorsAssessed).toBeGreaterThan(0);
});

it("surfaces the short sleep pattern that was deliberately planted", () => {
const sleep=out.results.find((r) => r.factor === "sleep_short");
expect(sleep).toBeDefined();
expect(sleep!.label).toBe("linked_more");
});

it("does not invent a link for a factor with no planted effect", () => {
const caffeine=out.results.find((r) => r.factor === "caffeine_change");
expect(caffeine!.label).not.toBe("linked_more");
const alcohol=out.results.find((r) => r.factor === "alcohol");
expect(alcohol!.label).not.toBe("linked_more");
});

it("reports a previous day relationship, not only same day", () => {
const sleep=out.results.find((r) => r.factor === "sleep_short");
expect(sleep!.lags.length).toBeGreaterThan(0);
expect(sleep!.lags.some((l) => l.lag === 1)).toBe(true);
});
});
