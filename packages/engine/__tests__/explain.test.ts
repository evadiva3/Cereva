
import {
allowedNumbers,
explainAll,
explainFactor,
findInventedNumbers,
REQUIRED_CAVEATS,
} from "../src/explain";
import { runEngine } from "../src/engine";
import { simulateUser } from "../src/simulate";
import { FACTOR_LABELS, type EngineOutput, type FactorResult } from "../src/types";

function outputWithFinding(): EngineOutput {
const { days }=simulateUser({
days: 730,
baseAttackRate: 0.13,
trigger: { factor: "sleep_short", oddsRatio: 5, lag: 1 },
logProbability: 0.85,
seed: 4242,
});
return runEngine(days);
}

function emptyOutput(): EngineOutput {
return runEngine([]);
}

describe("invented numbers", () => {
it("accepts text whose numbers all come from the engine", () => {
const output=outputWithFinding();
const allowed=allowedNumbers(output);
const result=output.results.find((r) => r.label === "linked_more")!;
const lag=result.lags[1]!;
const text =
`Short sleep the night before goes with more attacks. The odds ratio is ` +
`${lag.oddsRatio.toFixed(2)}, between ${lag.lower.toFixed(2)} and ` +
`${lag.upper.toFixed(2)}, across ${result.counts.onsets} attack starts.`;
expect(findInventedNumbers(text, allowed)).toEqual([]);
});

it("catches a percentage the model worked out for itself", () => {
const allowed=new Set(["1.80", "1.8", "14"]);
const text="An odds ratio of 1.80 is roughly an 80 percent increase across 14 attacks.";
expect(findInventedNumbers(text, allowed)).toContain("80");
});

it("catches a count the model rounded or invented", () => {
const allowed=new Set(["14", "1.80"]);
expect(findInventedNumbers("Across about 15 attacks.", allowed)).toContain("15");
expect(findInventedNumbers("Over the last 90 days.", allowed)).toContain("90");
});

it("catches a fabricated probability", () => {
const allowed=new Set(["2.10"]);
const text="There is a 95 percent chance this is a real effect.";
expect(findInventedNumbers(text, allowed)).toEqual(expect.arrayContaining(["95"]));
});

it("catches several inventions at once rather than stopping at the first", () => {
const allowed=new Set(["3.00"]);
const invented=findInventedNumbers("Up 200 percent over 45 days in 7 cases.", allowed);
expect(invented).toEqual(expect.arrayContaining(["200", "45", "7"]));
});

it("allows the small integers that ordinary English needs", () => {
const allowed=new Set(["1.80"]);
expect(findInventedNumbers("One of 2 things stood out.", allowed)).toEqual([]);
});

it("allows a reformatted version of an allowed number", () => {
const allowed=new Set(["1.8", "1.80"]);
expect(findInventedNumbers("The odds ratio is 1.80.", allowed)).toEqual([]);
expect(findInventedNumbers("The odds ratio is 1.8.", allowed)).toEqual([]);
});

it("is not fooled by a number embedded in a longer token", () => {
const allowed=new Set(["14"]);
expect(findInventedNumbers("Across 143 days.", allowed)).toContain("143");
});

it("allows text with no numbers at all", () => {
expect(findInventedNumbers("Nothing stood out this month.", new Set())).toEqual([]);
});
});

describe("allowedNumbers", () => {
it("includes every figure the engine actually produced", () => {
const output=outputWithFinding();
const allowed=allowedNumbers(output);
expect(allowed.has(String(output.onsets))).toBe(true);
expect(allowed.has(String(output.loggedDays))).toBe(true);
for(const result of output.results){
if(result.label === "not_enough_data") continue;
for(const lag of result.lags){
expect(allowed.has(lag.oddsRatio.toFixed(2))).toBe(true);
}
}
});

it("does not include numbers the engine never produced", () => {
const allowed=allowedNumbers(emptyOutput());
expect(allowed.has("97")).toBe(false);
expect(allowed.has("3.14")).toBe(false);
});
});

describe("templated explanations", () => {
it("every templated sentence passes its own invented-number check", () => {
const output=outputWithFinding();
const allowed=allowedNumbers(output);
const explained=explainAll(output);
const everything=[
explained.headline,
...explained.findings,
...explained.noClearLink,
...explained.notEnough,
...explained.caveats,
].join(" ");
expect(findInventedNumbers(everything, allowed)).toEqual([]);
});

it("never claims cause, while still carrying the not-a-cause disclaimer", () => {
const output=outputWithFinding();
const text=Object.values(explainAll(output)).flat().join(" ").toLowerCase();

for(const claim of [
"causes your",
"is causing",
"caused by",
"because of",
"proves",
"triggers your",
"due to",
"responsible for",
]){
expect(text).not.toContain(claim);
}

expect(text).toContain("not causes");
});

it("says not enough data plainly rather than hedging a weak finding", () => {
const explained=explainAll(emptyOutput());
expect(explained.headline).toContain("not enough");
expect(explained.findings).toEqual([]);
});

it("states that no clear link is not a ruling out", () => {
const result: FactorResult={
factor: "alcohol",
label: "no_clear_link",
reason: null,
counts: {
riskDays: 100,
onsets: 20,
exposedDays: 30,
unexposedDays: 70,
exposedOnsets: 6,
observedDays: 100,
},
lags: [],
rawP: 0.4,
adjustedP: 1,
perStandardDeviation: false,
continuousMode: false,
};
expect(explainFactor(result).toLowerCase()).toContain("not the same as ruling it out");
});

it("never recommends a medication change, and says so when reporting a finding", () => {
const output=outputWithFinding();
const explained=explainAll(output);
const caveats=explained.caveats.join(" ").toLowerCase();
expect(caveats).toContain("medication");
expect(caveats).toContain("doctor");

const everything=Object.values(explained).flat().join(" ").toLowerCase();
for(const banned of ["stop taking", "increase your dose", "reduce your dose", "you should take"]){
expect(everything).not.toContain(banned);
}
});

it("includes the required caveats whenever there is a finding", () => {
const output=outputWithFinding();
const explained=explainAll(output);
expect(explained.findings.length).toBeGreaterThan(0);
for(const caveat of REQUIRED_CAVEATS){
expect(explained.caveats).toContain(caveat);
}
});

it("names every factor it reports on", () => {
const output=outputWithFinding();
const explained=explainAll(output);
const all=[...explained.findings, ...explained.noClearLink, ...explained.notEnough];
expect(all.length).toBe(output.results.length);
for(const result of output.results){
expect(all.some((line) => line.startsWith(FACTOR_LABELS[result.factor]))).toBe(true);
}
});

it("uses no exclamation marks and no praise", () => {
const output=outputWithFinding();
const text=Object.values(explainAll(output)).flat().join(" ");
expect(text).not.toMatch(/!/);
expect(text).not.toMatch(/great|well done|congratulations|excellent/i);
});
});
