
import { cholesky, choleskyInverse, invert, quadForm, submatrix } from "../src/linalg";
import { chiSquareUpperTail, fitLogistic, normalCdf, waldP, zForCoverage } from "../src/logistic";
import { buildRiskSet, deriveFactors, lagMatrix } from "../src/features";
import { holmAdjust, runEngine, THRESHOLDS } from "../src/engine";
import { mulberry32, simulateUser } from "../src/simulate";
import { FACTOR_IDS, type DayRecord } from "../src/types";

function day(over: Partial<DayRecord> = {}): DayRecord {
return {
date: "2025-01-01",
logged: true,
attack: false,
alcohol: false,
caffeineChange: false,
skippedMeal: false,
stress: 1,
sleepMinutes: 420,
steps: 7000,
menstruating: false,
pressureChange: 0,
tempChange: 0,
humidity: 60,
loosenSession: false,
...over,
};
}

function series(n: number, fn: (i: number) => Partial<DayRecord>): DayRecord[] {
return Array.from({ length: n }, (_, i) => {
const d=new Date(Date.UTC(2025, 0, 1) + i * 86_400_000);
return day({ date: d.toISOString().slice(0, 10), ...fn(i) });
});
}

describe("linear algebra", () => {
it("factors and inverts a positive definite matrix", () => {
const a=[
[4, 1, 0],
[1, 3, 1],
[0, 1, 2],
];
const l=cholesky(a)!;
expect(l).not.toBeNull();
const inv=choleskyInverse(l);
for(let i = 0; i < 3; i++){
for(let j = 0; j < 3; j++){
let sum=0;
for(let k = 0; k < 3; k++) sum += a[i]![k]! * inv[k]![j]!;
expect(sum).toBeCloseTo(i === j ? 1 : 0, 9);
}
}
});

it("refuses a matrix that is not positive definite rather than returning nonsense", () => {
expect(cholesky([[1, 2], [2, 1]])).toBeNull();
expect(cholesky([[0, 0], [0, 0]])).toBeNull();
expect(invert([[1, 2], [2, 4]])).toBeNull();
});

it("computes a quadratic form", () => {
expect(quadForm([1, 2], [[1, 0], [0, 1]])).toBeCloseTo(5, 10);
expect(quadForm([1, 1], [[2, 1], [1, 2]])).toBeCloseTo(6, 10);
});

it("extracts a submatrix", () => {
const a=[
[1, 2, 3],
[4, 5, 6],
[7, 8, 9],
];
expect(submatrix(a, [0, 2])).toEqual([
[1, 3],
[7, 9],
]);
});
});

describe("distributions", () => {
it("normalCdf matches known values", () => {
expect(normalCdf(0)).toBeCloseTo(0.5, 6);
expect(normalCdf(1.959964)).toBeCloseTo(0.975, 4);
expect(normalCdf(-1.959964)).toBeCloseTo(0.025, 4);
expect(normalCdf(10)).toBeCloseTo(1, 6);
});

it("zForCoverage recovers the usual critical values", () => {
expect(zForCoverage(0.95)).toBeCloseTo(1.96, 2);
expect(zForCoverage(0.9)).toBeCloseTo(1.645, 2);
});

it("chiSquareUpperTail with two degrees of freedom has the closed form", () => {
for(const x of [0.5, 1, 2, 5.991, 10]){
expect(chiSquareUpperTail(x, 2)).toBeCloseTo(Math.exp(-x / 2), 10);
}
expect(chiSquareUpperTail(5.991, 2)).toBeCloseTo(0.05, 3);
});

it("chiSquareUpperTail refuses degrees of freedom it cannot do exactly", () => {
expect(() => chiSquareUpperTail(1, 3)).toThrow();
});

it("waldP is two-sided and bounded", () => {
expect(waldP(0, 1)).toBeCloseTo(1, 6);
expect(waldP(1.96, 1)).toBeCloseTo(0.05, 3);
expect(waldP(-1.96, 1)).toBeCloseTo(0.05, 3);
expect(waldP(5, 0)).toBe(1);
});
});

describe("logistic fit", () => {
it("recovers a known coefficient from clean data", () => {
const rand=mulberry32(7);
const x: number[][]=[];
const y: number[]=[];
for(let i = 0; i < 4000; i++){
const xi=rand() < 0.5 ? 1 : 0;
const p=1 / (1 + Math.exp(-(-1.0 + 1.0 * xi)));
x.push([1, xi]);
y.push(rand() < p ? 1 : 0);
}
const fit=fitLogistic(x, y, { priorSd: [10, 10] })!;
expect(fit).not.toBeNull();
expect(fit.converged).toBe(true);
expect(fit.beta[0]!).toBeCloseTo(-1.0, 1);
expect(fit.beta[1]!).toBeCloseTo(1.0, 1);
});

it("shrinks towards zero as the prior tightens", () => {
const x=Array.from({ length: 200 }, (_, i) => [1, i % 2]);
const y=x.map((row) => (row[1] === 1 ? (Math.random() < 0.7 ? 1 : 0) : 0));
const loose=fitLogistic(x, y, { priorSd: [10, 10] })!;
const tight=fitLogistic(x, y, { priorSd: [10, 0.1] })!;
expect(Math.abs(tight.beta[1]!)).toBeLessThan(Math.abs(loose.beta[1]!));
});

it("survives perfect separation instead of diverging", () => {
const x: number[][]=[];
const y: number[]=[];
for(let i = 0; i < 60; i++){
const exposed=i < 20 ? 1 : 0;
x.push([1, exposed]);
y.push(exposed);
}
const fit=fitLogistic(x, y, { priorSd: [5, 2] })!;
expect(fit).not.toBeNull();
expect(Number.isFinite(fit.beta[1]!)).toBe(true);
expect(Math.abs(fit.beta[1]!)).toBeLessThan(25);
});

it("rejects malformed input rather than guessing", () => {
expect(fitLogistic([], [], { priorSd: [1] })).toBeNull();
expect(fitLogistic([[1, 0]], [1], { priorSd: [1] })).toBeNull();
});
});

describe("risk set", () => {
it("excludes days that follow an attack, because they cannot be onsets", () => {
const days=series(10, (i) => ({ attack: i === 3 || i === 4 }));
const rs=buildRiskSet(days);
expect(rs.indices).not.toContain(4);
expect(rs.indices).not.toContain(5);
expect(rs.indices).toContain(3);
expect(rs.outcome[rs.indices.indexOf(3)]).toBe(1);
});

it("excludes days whose previous day is unknown", () => {
const days=series(10, (i) => ({ logged: i !== 4 }));
const rs=buildRiskSet(days);
expect(rs.indices).not.toContain(4);
expect(rs.indices).not.toContain(5);
});

it("marks recent attacks beyond lag one as clustering", () => {
const days=series(12, (i) => ({ attack: i === 2 }));
const rs=buildRiskSet(days);
const at=(i: number) => rs.recentAttack[rs.indices.indexOf(i)];
expect(at(4)).toBe(1);
expect(at(11)).toBe(0);
});

it("shrinks sharply for someone with very frequent attacks", () => {
const sparse=buildRiskSet(series(100, (i) => ({ attack: i % 10 === 0 })));
const dense=buildRiskSet(series(100, (i) => ({ attack: i % 2 === 0 })));
expect(dense.indices.length).toBeLessThan(sparse.indices.length * 0.6);
expect(sparse.indices.length).toBeGreaterThan(85);
expect(dense.indices.length).toBeLessThan(55);
});
});

describe("lag alignment", () => {
it("lag 1 is the value from the day before", () => {
const days=series(6, () => ({}));
const rs=buildRiskSet(days);
const values=[0, 1, 2, 3, 4, 5];
const { lag0, lag1 }=lagMatrix(values, rs);
for(let k = 0; k < rs.indices.length; k++){
const i=rs.indices[k]!;
expect(lag0[k]).toBe(i);
expect(lag1[k]).toBe(i - 1);
}
});
});

describe("derived factors", () => {
it("loosen_week looks back a week, not at the same day", () => {
const days=series(14, (i) => ({ loosenSession: i === 3 }));
const { loosen_week }=deriveFactors(days);
expect(loosen_week.values[2]).toBeNull();
expect(loosen_week.values[7]).toBe(1);
expect(loosen_week.values[13]).toBe(0);
});

it("standardises continuous factors within the person", () => {
const days=series(40, (i) => ({ steps: 5000 + i * 100 }));
const { steps }=deriveFactors(days);
const observed=steps.values.filter((v): v is number => v !== null);
const mean=observed.reduce((a, b) => a + b, 0) / observed.length;
expect(mean).toBeCloseTo(0, 6);
expect(steps.continuous).toBe(true);
});

it("returns all-null for a factor that never varies", () => {
const days=series(40, () => ({ humidity: 60 }));
const { humidity }=deriveFactors(days);
expect(humidity.values.every((v) => v === null)).toBe(true);
});
});

describe("Holm correction", () => {
it("multiplies the smallest p by the family size", () => {
expect(holmAdjust([0.01, 0.5])[0]).toBeCloseTo(0.02, 10);
});

it("is monotone: a larger raw p never gets a smaller adjusted p", () => {
const raw=[0.001, 0.02, 0.03, 0.9];
const adjusted=holmAdjust(raw);
const order=raw.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
for(let k = 1; k < order.length; k++){
expect(adjusted[order[k]!.i]!).toBeGreaterThanOrEqual(adjusted[order[k - 1]!.i]!);
}
});

it("caps at one and preserves input order", () => {
const adjusted=holmAdjust([0.9, 0.001, 0.5]);
expect(adjusted[0]).toBe(1);
expect(adjusted[1]!).toBeCloseTo(0.003, 10);
expect(adjusted.every((p) => p <= 1)).toBe(true);
});

it("is uniformly at least as strict as leaving p alone", () => {
const raw=[0.01, 0.02, 0.03];
holmAdjust(raw).forEach((adj, i) => expect(adj).toBeGreaterThanOrEqual(raw[i]!));
});

it("handles an empty family", () => {
expect(holmAdjust([])).toEqual([]);
});
});

describe("minimum data thresholds", () => {
it("reports nothing at all below sixty logged days", () => {
const days=series(50, (i) => ({ attack: i % 4 === 0 }));
const out=runEngine(days);
expect(out.overallReason).toBe("too_few_days");
expect(out.results).toHaveLength(FACTOR_IDS.length);
expect(out.results.every((r) => r.label === "not_enough_data")).toBe(true);
expect(out.factorsAssessed).toBe(0);
});

it("reports nothing with too few onsets, however many days", () => {
const days=series(300, (i) => ({ attack: i === 10 || i === 50 }));
const out=runEngine(days);
expect(out.overallReason).toBe("too_few_onsets");
expect(out.onsets).toBeLessThan(THRESHOLDS.minOnsets);
});

it("never emits a finding when it emits not_enough_data", () => {
const days=series(50, () => ({}));
const out=runEngine(days);
for(const r of out.results){
expect(r.label).toBe("not_enough_data");
expect(r.lags).toEqual([]);
expect(r.adjustedP).toBeNull();
}
});

it("gives a reason a person could act on", () => {
const out=runEngine(series(50, () => ({})));
for(const r of out.results) expect(r.reason).not.toBeNull();
});
});

describe("output shape", () => {
it("always returns every factor exactly once, in a stable order", () => {
const { days }=simulateUser({
days: 365,
baseAttackRate: 0.13,
trigger: null,
logProbability: 0.85,
seed: 11,
});
const out=runEngine(days);
expect(out.results.map((r) => r.factor)).toEqual([...FACTOR_IDS]);
});

it("is deterministic: the same diary gives the same answer", () => {
const { days }=simulateUser({
days: 365,
baseAttackRate: 0.13,
trigger: { factor: "alcohol", oddsRatio: 3, lag: 1 },
logProbability: 0.85,
seed: 12,
});
expect(JSON.stringify(runEngine(days))).toBe(JSON.stringify(runEngine(days)));
});

it("reports counts alongside every assessed factor", () => {
const { days }=simulateUser({
days: 365,
baseAttackRate: 0.13,
trigger: null,
logProbability: 0.85,
seed: 13,
});
const out=runEngine(days);
for(const r of out.results){
if(r.label === "not_enough_data") continue;
expect(r.counts.riskDays).toBeGreaterThan(0);
expect(r.counts.onsets).toBeGreaterThan(0);
expect(r.lags).toHaveLength(2);
for(const lag of r.lags){
expect(lag.lower).toBeLessThanOrEqual(lag.oddsRatio);
expect(lag.upper).toBeGreaterThanOrEqual(lag.oddsRatio);
}
}
});

it("reports the attack day fraction, which is what makes someone chronic", () => {
const { days }=simulateUser({
days: 365,
baseAttackRate: 0.3,
trigger: null,
logProbability: 0.85,
seed: 14,
});
const out=runEngine(days);
expect(out.attackDayFraction).toBeGreaterThan(0.3);
expect(out.attackDayFraction).toBeLessThanOrEqual(1);
});

it("handles an empty diary without throwing", () => {
const out=runEngine([]);
expect(out.overallReason).toBe("too_few_days");
expect(out.results).toHaveLength(FACTOR_IDS.length);
});
});

describe("finding a planted trigger", () => {
it("finds a strong trigger given enough data, in the right direction", () => {
let found=0;
for(let s = 0; s < 40; s++){
const { days }=simulateUser({
days: 730,
baseAttackRate: 0.13,
trigger: { factor: "alcohol", oddsRatio: 5, lag: 1 },
logProbability: 0.85,
seed: 20_000 + s,
});
const res=runEngine(days).results.find((r) => r.factor === "alcohol")!;
if(res.label === "linked_more") found++;
}
expect(found).toBeGreaterThan(30);
});

it("does not flag a factor in a diary with no trigger at all", () => {
let flagged=0;
for(let s = 0; s < 40; s++){
const { days }=simulateUser({
days: 365,
baseAttackRate: 0.13,
trigger: null,
logProbability: 0.85,
seed: 30_000 + s,
});
const out=runEngine(days);
if(out.results.some((r) => r.label === "linked_more" || r.label === "linked_fewer")){
flagged++;
}
}
expect(flagged).toBeLessThanOrEqual(4);
});
});
