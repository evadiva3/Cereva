
import { deriveFactors, buildRiskSet, lagMatrix } from "./features";
import { fitLogistic, waldP, zForCoverage } from "./logistic";
import { submatrix, type Matrix } from "./linalg";
import {
ENGINE_VERSION,
FACTOR_IDS,
type DayRecord,
type EngineOutput,
type FactorCounts,
type FactorId,
type FactorResult,
type InsufficientReason,
type LagEstimate,
} from "./types";

export const THRESHOLDS={
minLoggedDays: 60,
minOnsets: 10,
minObservedDays: 45,
minExposedDays: 10,
minUnexposedDays: 10,
minExposedOnsets: 3,
} as const;

export const COVERAGE=0.95;

export const ALPHA=0.05;

export const PRIOR_SD_EXPOSURE=2.0;
const PRIOR_SD_NUISANCE=5;

export interface EngineOptions {
priorSdExposure?: number;
alpha?: number;
}

function emptyCounts(): FactorCounts {
return {
riskDays: 0,
onsets: 0,
exposedDays: null,
unexposedDays: null,
exposedOnsets: null,
observedDays: 0,
};
}

function insufficient(
factor: FactorId,
reason: InsufficientReason,
counts: FactorCounts,
perStandardDeviation: boolean,
): FactorResult {
return {
factor,
label: "not_enough_data",
reason,
counts,
lags: [],
rawP: null,
adjustedP: null,
perStandardDeviation,
};
}

interface AssessedFactor {
factor: FactorId;
counts: FactorCounts;
lags: LagEstimate[];
rawP: number;
direction: "more" | "fewer";
perStandardDeviation: boolean;
}

function assessFactor(
factor: FactorId,
values: (number | null)[],
continuous: boolean,
riskSet: ReturnType<typeof buildRiskSet>,
priorSdExposure: number,
): FactorResult | AssessedFactor {
const counts=emptyCounts();
counts.riskDays=riskSet.indices.length;
counts.onsets=riskSet.outcome.reduce((a, b) => a + b, 0);

const { lag0, lag1 }=lagMatrix(values, riskSet);

const rows: number[]=[];
for(let i = 0; i < riskSet.indices.length; i++){
if(lag0[i] === null || lag1[i] === null) continue;
rows.push(i);
}
counts.observedDays=rows.length;

if(rows.length === 0){
return insufficient(factor, "not_collected", counts, continuous);
}

if(!continuous){
let exposed=0;
let unexposed=0;
let exposedOnsets=0;
for(const i of rows){
const anyExposure=(lag0[i] ?? 0) > 0 || (lag1[i] ?? 0) > 0;
if(anyExposure){
exposed++;
if(riskSet.outcome[i] === 1) exposedOnsets++;
}else{
unexposed++;
}
}
counts.exposedDays=exposed;
counts.unexposedDays=unexposed;
counts.exposedOnsets=exposedOnsets;
}

if(counts.observedDays < THRESHOLDS.minObservedDays){
return insufficient(factor, "too_few_days", counts, continuous);
}
if(!continuous){
if((counts.exposedDays ?? 0) < THRESHOLDS.minExposedDays){
return insufficient(factor, "too_few_exposed", counts, continuous);
}
if((counts.unexposedDays ?? 0) < THRESHOLDS.minUnexposedDays){
return insufficient(factor, "too_few_unexposed", counts, continuous);
}
if((counts.exposedOnsets ?? 0) < THRESHOLDS.minExposedOnsets){
return insufficient(factor, "too_few_exposed_onsets", counts, continuous);
}
}

const distinct0=new Set(rows.map((i) => lag0[i]));
const distinct1=new Set(rows.map((i) => lag1[i]));
if(distinct0.size < 2 && distinct1.size < 2){
return insufficient(factor, "no_variation", counts, continuous);
}

const x: Matrix=rows.map((i) => [1, riskSet.recentAttack[i]!, lag0[i]!, lag1[i]!]);
const y=rows.map((i) => riskSet.outcome[i]!);
const priorSd=[PRIOR_SD_NUISANCE, PRIOR_SD_NUISANCE, priorSdExposure, priorSdExposure];

const fit=fitLogistic(x, y, { priorSd });
if(!fit || !fit.converged){
return insufficient(factor, "fit_failed", counts, continuous);
}

const exposureIndices=[2, 3];
const beta=exposureIndices.map((i) => fit.beta[i]!);
const cov=submatrix(fit.covariance, exposureIndices);

const p0=waldP(beta[0]!, Math.sqrt(Math.max(cov[0]![0]!, 0)));
const p1=waldP(beta[1]!, Math.sqrt(Math.max(cov[1]![1]!, 0)));
const rawP=1 - Math.pow(1 - Math.min(p0, p1), 2);

const z=zForCoverage(COVERAGE);
const lags: LagEstimate[]=exposureIndices.map((index, k) => {
const est=fit.beta[index]!;
const se=Math.sqrt(Math.max(fit.covariance[index]![index]!, 0));
return {
lag: k === 0 ? 0 : 1,
oddsRatio: Math.exp(est),
lower: Math.exp(est - z * se),
upper: Math.exp(est + z * se),
};
});

const dominant=Math.abs(beta[0]!) >= Math.abs(beta[1]!) ? beta[0]! : beta[1]!;

return {
factor,
counts,
lags,
rawP,
direction: dominant >= 0 ? "more" : "fewer",
perStandardDeviation: continuous,
};
}

export function holmAdjust(pValues: number[]): number[] {
const m=pValues.length;
if(m === 0) return [];
const order=pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
const adjusted=new Array<number>(m);
let running=0;
for(let k = 0; k < m; k++){
const entry=order[k]!;
const scaled=Math.min(1, (m - k) * entry.p);
running=Math.max(running, scaled);
adjusted[entry.i]=running;
}
return adjusted;
}

export function runEngine(days: DayRecord[], options: EngineOptions = {}): EngineOutput {
const priorSdExposure=options.priorSdExposure ?? PRIOR_SD_EXPOSURE;
const alpha=options.alpha ?? ALPHA;
const loggedDays=days.filter((d) => d.logged).length;
const attackDays=days.filter((d) => d.logged && d.attack).length;
const riskSet=buildRiskSet(days);
const onsets=riskSet.outcome.reduce((a, b) => a + b, 0);

const base: EngineOutput={
engineVersion: ENGINE_VERSION,
windowStart: days.length > 0 ? days[0]!.date : null,
windowEnd: days.length > 0 ? days[days.length - 1]!.date : null,
loggedDays,
riskDays: riskSet.indices.length,
onsets,
attackDayFraction: loggedDays > 0 ? attackDays / loggedDays : 0,
factorsAssessed: 0,
results: [],
overallReason: null,
};

const everyFactorInsufficient=(reason: InsufficientReason): EngineOutput => {
const factors=deriveFactors(days);
return {
...base,
overallReason: reason,
results: FACTOR_IDS.map((factor) => {
const counts=emptyCounts();
counts.riskDays=riskSet.indices.length;
counts.onsets=onsets;
return insufficient(factor, reason, counts, factors[factor].continuous);
}),
};
};

if(loggedDays < THRESHOLDS.minLoggedDays) return everyFactorInsufficient("too_few_days");
if(onsets < THRESHOLDS.minOnsets) return everyFactorInsufficient("too_few_onsets");

const factors=deriveFactors(days);
const finished: FactorResult[]=[];
const assessed: AssessedFactor[]=[];

for(const factor of FACTOR_IDS){
const { values, continuous }=factors[factor];
const outcome=assessFactor(factor, values, continuous, riskSet, priorSdExposure);
if("label" in outcome) finished.push(outcome);
else assessed.push(outcome);
}

const adjusted=holmAdjust(assessed.map((a) => a.rawP));

const assessedResults: FactorResult[]=assessed.map((a, i) => {
const adjustedP=adjusted[i]!;
const sig=adjustedP < alpha;
return {
factor: a.factor,
label: sig ? (a.direction === "more" ? "linked_more" : "linked_fewer") : "no_clear_link",
reason: null,
counts: a.counts,
lags: a.lags,
rawP: a.rawP,
adjustedP,
perStandardDeviation: a.perStandardDeviation,
};
});

const byFactor=new Map<FactorId, FactorResult>();
for(const result of [...finished, ...assessedResults]) byFactor.set(result.factor, result);

return {
...base,
factorsAssessed: assessed.length,
results: FACTOR_IDS.map((factor) => byFactor.get(factor)!),
};
}
