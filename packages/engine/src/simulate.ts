
import type { DayRecord, FactorId } from "./types";

export function mulberry32(seed: number): () => number {
let a=seed >>> 0;
return () => {
a |= 0;
a=(a + 0x6d2b79f5) | 0;
let t=Math.imul(a ^ (a >>> 15), 1 | a);
t=(t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

function gaussian(rand: () => number): number {
let u=0;
let v=0;
while(u === 0) u = rand();
while(v === 0) v = rand();
return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function autocorrelated(n: number, rho: number, rand: () => number): number[] {
const out=new Array<number>(n);
let prev=gaussian(rand);
for(let i = 0; i < n; i++){
prev=rho * prev + Math.sqrt(1 - rho * rho) * gaussian(rand);
out[i]=prev;
}
return out;
}

export interface SimulationSpec {
days: number;
baseAttackRate: number;
trigger: { factor: FactorId; oddsRatio: number; lag: 0 | 1 } | null;
logProbability: number;
seed: number;
}

export interface SimulatedUser {
days: DayRecord[];
spec: SimulationSpec;
realisedAttackFraction: number;
}

function logit(p: number): number {
return Math.log(p / (1 - p));
}

function sigmoid(z: number): number {
return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

const DAY_MS=86_400_000;

function dateAt(index: number): string {
const base=Date.UTC(2025, 0, 1);
const d=new Date(base + index * DAY_MS);
const y=d.getUTCFullYear();
const m=String(d.getUTCMonth() + 1).padStart(2, "0");
const day=String(d.getUTCDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
}

export function simulateUser(spec: SimulationSpec): SimulatedUser {
const rand=mulberry32(spec.seed);
const n=spec.days;

const sleepZ=autocorrelated(n, 0.35, rand);
const stepsZ=autocorrelated(n, 0.45, rand);
const pressureZ=autocorrelated(n, 0.6, rand);
const tempZ=autocorrelated(n, 0.75, rand);
const humidityZ=autocorrelated(n, 0.7, rand);
const stressZ=autocorrelated(n, 0.5, rand);

const alcohol: boolean[]=[];
const caffeine: boolean[]=[];
const skipped: boolean[]=[];
const loosen: boolean[]=[];
const menstruating: boolean[]=[];
const cycleStart=Math.floor(rand() * 28);
for(let i = 0; i < n; i++){
const weekend=i % 7 === 5 || i % 7 === 6;
alcohol.push(rand() < 0.15);
caffeine.push(rand() < 0.18);
skipped.push(rand() < (weekend ? 0.1 : 0.17));
loosen.push(!weekend && rand() < 0.3);
const cycleDay=(i + cycleStart) % 28;
menstruating.push(cycleDay < 5);
}

const shortSleep=sleepZ.map((z) => (z < -0.75 ? 1 : 0));

const factorSeries: Record<FactorId, number[]>={
sleep_short: shortSleep,
steps: stepsZ,
pressure_change: pressureZ,
temp_change: tempZ,
humidity: humidityZ,
alcohol: alcohol.map((v) => (v ? 1 : 0)),
caffeine_change: caffeine.map((v) => (v ? 1 : 0)),
skipped_meal: skipped.map((v) => (v ? 1 : 0)),
stress: stressZ,
cycle: menstruating.map((v) => (v ? 1 : 0)),
loosen_week: loosen.map((v) => (v ? 1 : 0)),
};

const baseLogit=logit(Math.min(0.9, Math.max(0.01, spec.baseAttackRate)));
const triggerBeta=spec.trigger ? Math.log(spec.trigger.oddsRatio) : 0;

const attack: boolean[]=[];
for(let i = 0; i < n; i++){
let z=baseLogit;

if(i >= 1 && attack[i - 1]) z += 1.6;
else if(i >= 2 && attack[i - 2]) z += 0.5;

if(spec.trigger){
const series=factorSeries[spec.trigger.factor]!;
const index=i - spec.trigger.lag;
if(index >= 0) z += triggerBeta * series[index]!;
}

attack.push(rand() < sigmoid(z));
}

const days: DayRecord[]=[];
for(let i = 0; i < n; i++){
const logged=attack[i] ? rand() < 0.95 : rand() < spec.logProbability;

const haveHealth=rand() < 0.9;
const haveWeather=rand() < 0.95;

days.push({
date: dateAt(i),
logged,
attack: attack[i]!,
severity: logged ? (attack[i] ? 2 : 0) : null,
alcohol: logged ? alcohol[i]! : null,
caffeineChange: logged ? caffeine[i]! : null,
skippedMeal: logged ? skipped[i]! : null,
stress: logged ? Math.round((stressZ[i]! + 1.5) / 1.5) : null,
sleepMinutes: haveHealth ? 420 + sleepZ[i]! * 70 : null,
steps: haveHealth ? Math.max(0, 7000 + stepsZ[i]! * 3000) : null,
menstruating: menstruating[i]!,
pressureChange: haveWeather ? pressureZ[i]! * 4 : null,
tempChange: haveWeather ? tempZ[i]! * 3 : null,
humidity: haveWeather ? 60 + humidityZ[i]! * 15 : null,
loosenSession: loosen[i]!,
});
}

const loggedDays=days.filter((d) => d.logged).length;
const attackDays=days.filter((d) => d.logged && d.attack).length;

return {
days,
spec,
realisedAttackFraction: loggedDays > 0 ? attackDays / loggedDays : 0,
};
}
