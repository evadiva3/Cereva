
import type { DayRecord, FactorId } from "./types";

const CLUSTER_WINDOW_DAYS=7;

const SHORT_SLEEP_SD=-0.75;

export interface FactorValues {
values: (number | null)[];
continuous: boolean;
}

function standardDeviation(values: number[]): number {
if(values.length < 2) return 0;
const mean=values.reduce((a, b) => a + b, 0) / values.length;
const variance =
values.reduce((total, v) => total + (v - mean) * (v - mean), 0) / (values.length - 1);
return Math.sqrt(variance);
}

function standardise(raw: (number | null)[]): (number | null)[] {
const observed=raw.filter((v): v is number => v !== null && Number.isFinite(v));
if(observed.length < 2) return raw.map(() => null);
const mean=observed.reduce((a, b) => a + b, 0) / observed.length;
const sd=standardDeviation(observed);
if(!(sd > 0)) return raw.map(() => null);
return raw.map((v) => (v === null || !Number.isFinite(v) ? null : (v - mean) / sd));
}

function bool(v: boolean | null): number | null {
return v === null ? null : v ? 1 : 0;
}

export function deriveFactors(days: DayRecord[]): Record<FactorId, FactorValues> {
const n=days.length;

const sleepRaw=days.map((d) => d.sleepMinutes);
const sleepZ=standardise(sleepRaw);
const sleepShort: (number | null)[]=sleepZ.map((z) =>
z === null ? null : z < SHORT_SLEEP_SD ? 1 : 0,
);

const loosenWeek: (number | null)[]=new Array(n).fill(null);
for(let i = 0; i < n; i++){
let any=false;
for(let k = Math.max(0, i - 6); k <= i; k++){
if(days[k]!.loosenSession){
any=true;
break;
}
}
loosenWeek[i]=i >= 6 ? (any ? 1 : 0) : null;
}

return {
sleep_short: { values: sleepShort, continuous: false },
steps: { values: standardise(days.map((d) => d.steps)), continuous: true },
pressure_change: {
values: standardise(days.map((d) => d.pressureChange)),
continuous: true,
},
temp_change: { values: standardise(days.map((d) => d.tempChange)), continuous: true },
humidity: { values: standardise(days.map((d) => d.humidity)), continuous: true },
alcohol: { values: days.map((d) => bool(d.alcohol)), continuous: false },
caffeine_change: { values: days.map((d) => bool(d.caffeineChange)), continuous: false },
skipped_meal: { values: days.map((d) => bool(d.skippedMeal)), continuous: false },
stress: { values: standardise(days.map((d) => d.stress)), continuous: true },
cycle: { values: days.map((d) => bool(d.menstruating)), continuous: false },
loosen_week: { values: loosenWeek, continuous: false },
};
}

export interface RiskSet {
indices: number[];
outcome: number[];
recentAttack: number[];
}

export function buildRiskSet(days: DayRecord[]): RiskSet {
const indices: number[]=[];
const outcome: number[]=[];
const recentAttack: number[]=[];

for(let i = 1; i < days.length; i++){
const day=days[i]!;
const prev=days[i - 1]!;
if(!day.logged) continue;
if(!prev.logged) continue;
if(prev.attack) continue;

indices.push(i);
outcome.push(day.attack ? 1 : 0);

let cluster=0;
for(let k = Math.max(0, i - CLUSTER_WINDOW_DAYS); k <= i - 2; k++){
if(days[k]!.attack){
cluster=1;
break;
}
}
recentAttack.push(cluster);
}

return { indices, outcome, recentAttack };
}

export function lagMatrix(
values: (number | null)[],
riskSet: RiskSet,
): { lag0: (number | null)[]; lag1: (number | null)[] } {
const lag0=riskSet.indices.map((i) => values[i] ?? null);
const lag1=riskSet.indices.map((i) => (i >= 1 ? (values[i - 1] ?? null) : null));
return { lag0, lag1 };
}

export const MAX_SEVERITY=3;

export function buildWorseningRiskSet(days: DayRecord[]): RiskSet {
const indices: number[]=[];
const outcome: number[]=[];
const recentAttack: number[]=[];

for(let i = 1; i < days.length; i++){
const day=days[i]!;
const prev=days[i - 1]!;
if(!day.logged || !prev.logged) continue;
if(day.severity === null || prev.severity === null) continue;
if(prev.severity >= MAX_SEVERITY) continue;

indices.push(i);
outcome.push(day.severity > prev.severity ? 1 : 0);

let cluster=0;
for(let k = Math.max(0, i - CLUSTER_WINDOW_DAYS); k <= i - 2; k++){
const a=days[k]!;
const b=days[k + 1]!;
if(a.severity !== null && b.severity !== null && b.severity > a.severity){
cluster=1;
break;
}
}
recentAttack.push(cluster);
}

return { indices, outcome, recentAttack };
}
