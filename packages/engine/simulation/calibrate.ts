
import { runEngine } from "../src/engine";
import { simulateUser, type SimulationSpec } from "../src/simulate";
import type { FactorId } from "../src/types";

const USERS=Number(process.env.SIM_USERS ?? 300);

const PRIOR_CANDIDATES=[0.9, 1.5, 2.0, 3.0, 5.0];

const CONDITIONS: { days: number; rate: number; name: string }[]=[
{ days: 180, rate: 0.08, name: "episodic" },
{ days: 180, rate: 0.13, name: "frequent" },
{ days: 180, rate: 0.3, name: "chronic" },
];

const PLANTED: { factor: FactorId; oddsRatio: number; lag: 0 | 1 }[]=[
{ factor: "sleep_short", oddsRatio: 2.0, lag: 1 },
{ factor: "sleep_short", oddsRatio: 3.0, lag: 1 },
{ factor: "skipped_meal", oddsRatio: 2.5, lag: 0 },
{ factor: "pressure_change", oddsRatio: 1.8, lag: 0 },
];

function measure(priorSdExposure: number): {
falsePositiveRate: number;
sensitivity: number;
medianEstimate: number;
} {
let nullUsersWithFinding=0;
let nullUsers=0;
let seed=1;

for(const condition of CONDITIONS){
for(let u = 0; u < USERS; u++){
const spec: SimulationSpec={
days: condition.days,
baseAttackRate: condition.rate,
trigger: null,
logProbability: 0.85,
seed: seed++,
};
const output=runEngine(simulateUser(spec).days, { priorSdExposure });
nullUsers++;
if(output.results.some((r) => r.label === "linked_more" || r.label === "linked_fewer")){
nullUsersWithFinding++;
}
}
}

let found=0;
let total=0;
const estimates: number[]=[];
seed=2_000_000;

for(const condition of CONDITIONS){
for(const planted of PLANTED){
for(let u = 0; u < USERS; u++){
const spec: SimulationSpec={
days: condition.days,
baseAttackRate: condition.rate,
trigger: planted,
logProbability: 0.85,
seed: seed++,
};
const output=runEngine(simulateUser(spec).days, { priorSdExposure });
const target=output.results.find((r) => r.factor === planted.factor);
total++;
if(target?.label === "linked_more") found++;
const lag=target?.lags.find((l) => l.lag === planted.lag);
if(lag) estimates.push(lag.oddsRatio);
}
}
}

const sorted=[...estimates].sort((a, b) => a - b);
return {
falsePositiveRate: nullUsersWithFinding / nullUsers,
sensitivity: found / total,
medianEstimate: sorted.length ? sorted[Math.floor(sorted.length / 2)]! : NaN,
};
}

function pct(x: number): string {
return `${(x * 100).toFixed(1)}%`;
}

function main(): void {
process.stdout.write(
`Prior sweep, ${USERS} users per condition per arm.\n\n` +
"| Prior SD | 95% prior OR range | False positive rate | Sensitivity | Median estimated OR |\n" +
"|---|---|---|---|---|\n",
);

const rows: { sd: number; fpr: number; sens: number }[]=[];
for(const sd of PRIOR_CANDIDATES){
const result=measure(sd);
rows.push({ sd, fpr: result.falsePositiveRate, sens: result.sensitivity });
const lo=Math.exp(-1.96 * sd).toFixed(2);
const hi=Math.exp(1.96 * sd).toFixed(1);
process.stdout.write(
`| ${sd} | ${lo} to ${hi} | ${pct(result.falsePositiveRate)} | ` +
`${pct(result.sensitivity)} | ${result.medianEstimate.toFixed(2)} |\n`,
);
}

const viable=rows.filter((r) => r.fpr <= 0.05);
process.stdout.write("\n");
if(viable.length === 0){
process.stdout.write("No candidate held the false positive rate at or below 5 percent.\n");
process.exit(1);
}
const best=viable.reduce((a, b) => (b.sens > a.sens ? b : a));
process.stdout.write(
`Best viable prior SD: ${best.sd} ` +
`(false positive rate ${pct(best.fpr)}, sensitivity ${pct(best.sens)}).\n`,
);
}

main();
