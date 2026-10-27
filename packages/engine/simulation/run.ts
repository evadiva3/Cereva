
import { runEngine } from "../src/engine";
import { simulateUser, type SimulationSpec } from "../src/simulate";
import { FACTOR_IDS, type FactorId } from "../src/types";

const USERS_PER_CELL=Number(process.env.SIM_USERS ?? 400);

const DAY_LENGTHS=[30, 60, 90, 180, 365];

const FREQUENCIES: { name: string; rate: number }[]=[
{ name: "episodic", rate: 0.08 },
{ name: "chronic", rate: 0.3 },
];

const PLANTED: { factor: FactorId; oddsRatio: number; lag: 0 | 1 }[]=[
{ factor: "sleep_short", oddsRatio: 2.0, lag: 1 },
{ factor: "sleep_short", oddsRatio: 3.0, lag: 1 },
{ factor: "pressure_change", oddsRatio: 1.5, lag: 0 },
{ factor: "skipped_meal", oddsRatio: 2.0, lag: 0 },
];

interface NullCell {
days: number;
frequency: string;
users: number;
withFinding: number;
falsePositiveRate: number;
nFinds: number;
withAssess: number;
meanFactorsAssessed: number;
}

interface PowerCell {
days: number;
frequency: string;
factor: FactorId;
oddsRatio: number;
lag: 0 | 1;
users: number;
found: number;
sensitivity: number;
assessable: number;
otherFindings: number;
}

function runNullArm(): NullCell[] {
const cells: NullCell[]=[];
let seed=1;

for(const days of DAY_LENGTHS){
for(const frequency of FREQUENCIES){
let withFinding=0;
let nFinds=0;
let withAssess=0;
let factorsAssessedTotal=0;

for(let u = 0; u < USERS_PER_CELL; u++){
const spec: SimulationSpec={
days,
baseAttackRate: frequency.rate,
trigger: null,
logProbability: 0.85,
seed: seed++,
};
const { days: diary }=simulateUser(spec);
const output=runEngine(diary);

const finds=output.results.filter(
(r) => r.label === "linked_more" || r.label === "linked_fewer",
).length;
if(finds > 0) withFinding++;
nFinds += finds;
if(output.factorsAssessed > 0) withAssess++;
factorsAssessedTotal += output.factorsAssessed;
}

cells.push({
days,
frequency: frequency.name,
users: USERS_PER_CELL,
withFinding,
falsePositiveRate: withFinding / USERS_PER_CELL,
nFinds,
withAssess,
meanFactorsAssessed: factorsAssessedTotal / USERS_PER_CELL,
});
}
}
return cells;
}

function runPowerArm(): PowerCell[] {
const cells: PowerCell[]=[];
let seed=1_000_000;

for(const days of DAY_LENGTHS){
for(const frequency of FREQUENCIES){
for(const planted of PLANTED){
let found=0;
let assessable=0;
let otherFindings=0;

for(let u = 0; u < USERS_PER_CELL; u++){
const spec: SimulationSpec={
days,
baseAttackRate: frequency.rate,
trigger: planted,
logProbability: 0.85,
seed: seed++,
};
const { days: diary }=simulateUser(spec);
const output=runEngine(diary);

const target=output.results.find((r) => r.factor === planted.factor);
if(target && target.label !== "not_enough_data") assessable++;
if(target && target.label === (planted.oddsRatio >= 1 ? "linked_more" : "linked_fewer")){
found++;
}
otherFindings += output.results.filter(
(r) =>
r.factor !== planted.factor &&
(r.label === "linked_more" || r.label === "linked_fewer"),
).length;
}

cells.push({
days,
frequency: frequency.name,
factor: planted.factor,
oddsRatio: planted.oddsRatio,
lag: planted.lag,
users: USERS_PER_CELL,
found,
sensitivity: found / USERS_PER_CELL,
assessable,
otherFindings,
});
}
}
}
return cells;
}

function pct(x: number): string {
return `${(x * 100).toFixed(1)}%`;
}

function main(): void {
const started=Date.now();
process.stdout.write(
`Running ${USERS_PER_CELL} users per cell. Factor set: ${FACTOR_IDS.length}.\n\n`,
);

const nullCells=runNullArm();
const powerCells=runPowerArm();
const elapsed=((Date.now() - started) / 1000).toFixed(1);

const worst=nullCells.reduce((a, b) => (b.falsePositiveRate > a.falsePositiveRate ? b : a));
const pass=worst.falsePositiveRate <= 0.05;

const lines: string[]=[];
lines.push("## False positive rate, null users");
lines.push("");
lines.push(
"Users with no true trigger of any kind. A finding on any of the eleven " +
"factors is a false positive. The pass condition is 5 percent or below.",
);
lines.push("");
lines.push("| Days | Attack frequency | Users | Any false finding | False positive rate | Factors testable (mean) |");
lines.push("|---|---|---|---|---|---|");
for(const cell of nullCells){
lines.push(
`| ${cell.days} | ${cell.frequency} | ${cell.users} | ${cell.withFinding} | ` +
`**${pct(cell.falsePositiveRate)}** | ${cell.meanFactorsAssessed.toFixed(1)} |`,
);
}
lines.push("");
lines.push(
`Worst cell: **${pct(worst.falsePositiveRate)}** at ${worst.days} days, ` +
`${worst.frequency}. Pass condition (at or below 5 percent): ` +
`**${pass ? "met" : "NOT MET"}**.`,
);
lines.push("");

lines.push("## Sensitivity, users with a planted trigger");
lines.push("");
lines.push(
"The share of users for whom the engine found the planted factor, in the " +
"correct direction. At 30 days nothing is reported by design: the " +
"minimum data thresholds are not met, so sensitivity is zero rather " +
"than low.",
);
lines.push("");
lines.push("| Days | Frequency | Planted factor | True OR | Lag | Testable | Found | Sensitivity |");
lines.push("|---|---|---|---|---|---|---|---|");
for(const cell of powerCells){
lines.push(
`| ${cell.days} | ${cell.frequency} | ${cell.factor} | ${cell.oddsRatio} | ${cell.lag} | ` +
`${cell.assessable} | ${cell.found} | **${pct(cell.sensitivity)}** |`,
);
}
lines.push("");
lines.push(`Generated in ${elapsed}s with ${USERS_PER_CELL} users per cell.`);
lines.push("");

const report=lines.join("\n");
process.stdout.write(report);

if(!pass){
process.stderr.write(
`\nFAIL: worst-cell false positive rate ${pct(worst.falsePositiveRate)} exceeds 5 percent.\n`,
);
process.exit(1);
}
}

main();
