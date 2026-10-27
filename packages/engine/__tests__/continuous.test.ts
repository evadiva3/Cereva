import { runEngine, THRESHOLDS } from "../src/engine";
import { buildRiskSet, buildWorseningRiskSet } from "../src/features";
import { mulberry32 } from "../src/simulate";
import type { DayRecord } from "../src/types";

function dateAt(i: number){
const d=new Date(Date.UTC(2025, 0, 1));
d.setUTCDate(d.getUTCDate() + i);
return d.toISOString().slice(0, 10);
}

function neverEnds(n=240, seed=7): DayRecord[] {
const rand=mulberry32(seed);
const days: DayRecord[]=[];
for(let i = 0; i < n; i++){
const shortSleep=rand() < 0.2;
const base=rand() < 0.5 ? 1 : 2;
const bump=shortSleep && rand() < 0.7 ? 1 : 0;
days.push({
date: dateAt(i),
logged: true,
attack: true,
severity: Math.min(3, base + bump),
alcohol: false,
caffeineChange: false,
skippedMeal: false,
stress: null,
sleepMinutes: shortSleep ? 300 : 460,
steps: 5000,
menstruating: null,
pressureChange: 0,
tempChange: 0,
humidity: 50,
loosenSession: false,
});
}
return days;
}

describe("a migraine that never ends", () => {
const days=neverEnds();

it("produces no onsets at all under the episodic risk set", () => {
const episodic=buildRiskSet(days);
expect(episodic.outcome.reduce((a, b) => a + b, 0)).toBe(0);
expect(episodic.indices.length).toBe(0);
});

it("still has days it got worse, which is the thing to analyse", () => {
const worsening=buildWorseningRiskSet(days);
expect(worsening.indices.length).toBeGreaterThan(50);
expect(worsening.outcome.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(
THRESHOLDS.minWorsenings,
);
});

it("switches itself to continuous rather than asking when it started", () => {
expect(runEngine(days).mode).toBe("continuous");
});

it("no longer reports too_few_onsets forever", () => {
const out=runEngine(days);
expect(out.overallReason).not.toBe("too_few_onsets");
expect(out.factorsAssessed).toBeGreaterThan(0);
});

it("never treats a day at the worst level as a day that could worsen", () => {
const maxed=days.map((d) => ({ ...d, severity: 3 }));
expect(buildWorseningRiskSet(maxed).indices.length).toBe(0);
});

it("leaves an ordinary episodic diary in episodic mode", () => {
const episodic=days.map((d, i) => ({
...d,
attack: i % 10 === 0,
severity: i % 10 === 0 ? 2 : 0,
}));
expect(runEngine(episodic).mode).toBe("episodic");
});

it("skips days where either severity is unknown rather than guessing", () => {
const gappy=days.map((d, i) => (i % 2 === 0 ? { ...d, severity: null } : d));
expect(buildWorseningRiskSet(gappy).indices.length).toBe(0);
});
});
