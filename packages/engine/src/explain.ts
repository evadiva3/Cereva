
import { LABEL_TEXT, type EngineOutput, type FactorResult } from "./types";
import { FACTOR_LABELS } from "./types";

const FACTOR_PHRASES: Record<string, string>={
sleep_short: "a short night's sleep",
steps: "how much you moved",
pressure_change: "a change in air pressure",
temp_change: "a change in temperature",
humidity: "humidity",
alcohol: "alcohol",
caffeine_change: "a change in caffeine",
skipped_meal: "skipping a meal",
stress: "stress",
cycle: "your cycle",
loosen_week: "practising Loosen that week",
};

function phrase(factor: string): string {
return FACTOR_PHRASES[factor] ?? FACTOR_LABELS[factor as keyof typeof FACTOR_LABELS] ?? factor;
}

function fmt(n: number): string {
return n.toFixed(2);
}

export function allowedNumbers(output: EngineOutput): Set<string> {
const allowed=new Set<string>();
const add=(n: number | null | undefined) => {
if(n === null || n === undefined || !Number.isFinite(n)) return;
allowed.add(String(n));
allowed.add(fmt(n));
allowed.add(String(Math.round(n)));
};

add(output.loggedDays);
add(output.riskDays);
add(output.onsets);
add(output.factorsAssessed);

for(const result of output.results){
add(result.counts.riskDays);
add(result.counts.onsets);
add(result.counts.exposedDays);
add(result.counts.unexposedDays);
add(result.counts.exposedOnsets);
add(result.counts.observedDays);
for(const lag of result.lags){
add(lag.oddsRatio);
add(lag.lower);
add(lag.upper);
add(lag.lag);
}
}
return allowed;
}

export function findInventedNumbers(text: string, allowed: Set<string>): string[] {
const WORD_NUMBERS_OK=new Set(["0", "1", "2"]);
const found=text.match(/\d+(?:\.\d+)?/g) ?? [];
const bad: string[]=[];
for(const token of found){
if(allowed.has(token)) continue;
if(WORD_NUMBERS_OK.has(token)) continue;
const asNumber=Number(token);
if(Number.isFinite(asNumber) && allowed.has(fmt(asNumber))) continue;
bad.push(token);
}
return bad;
}

export function explainFactor(result: FactorResult): string {
if(result.label === "not_enough_data"){
return `${FACTOR_LABELS[result.factor]}: ${LABEL_TEXT[result.label]}. ${reasonText(result)}`;
}

if(result.label === "no_clear_link"){
return (
`${FACTOR_LABELS[result.factor]}: no clear link in your data. ` +
`That is not the same as ruling it out.`
);
}

const strongest=result.lags.reduce((a, b) =>
Math.abs(Math.log(b.oddsRatio)) > Math.abs(Math.log(a.oddsRatio)) ? b : a,
);
const when=strongest.lag === 0 ? "the same day" : "the day before";
const direction=result.label === "linked_more" ? "more" : "fewer";
const unit=result.perStandardDeviation ? " for each step up in it" : "";

return (
`${FACTOR_LABELS[result.factor]}: in your data, ${phrase(result.factor)} on ` +
`${when} goes with ${direction} attacks${unit}. ` +
`The odds ratio is ${fmt(strongest.oddsRatio)}, somewhere between ` +
`${fmt(strongest.lower)} and ${fmt(strongest.upper)}. ` +
`This is based on ${result.counts.onsets} ${
result.continuousMode ? "days it got worse" : "attack starts"
} across ${result.counts.observedDays} days.`
);
}

function reasonText(result: FactorResult): string {
switch(result.reason){
case "too_few_days":
return `There are ${result.counts.observedDays} usable days for it so far.`;
case "too_few_onsets":
return `There have been ${result.counts.onsets} attack starts so far.`;
case "too_few_worsenings":
return `There have been ${result.counts.onsets} days it clearly got worse so far.`;
case "too_few_exposed":
return `It has only come up on ${result.counts.exposedDays} days.`;
case "too_few_unexposed":
return `There are only ${result.counts.unexposedDays} days without it to compare against.`;
case "too_few_exposed_onsets":
return `Only ${result.counts.exposedOnsets} attacks have started on days it was present.`;
case "no_variation":
return "It has not varied, so there is nothing to compare.";
case "not_collected":
return "It is not being collected on this device.";
case "fit_failed":
return "The numbers for it did not settle. More days will help.";
default:
return "";
}
}

export const REQUIRED_CAVEATS=[
"These are patterns in your own diary, not causes. Something else that moves with them could be doing the work.",
"A factor with no clear link has not been ruled out. It usually means there is not enough of it in your data yet.",
"Nothing here is a reason to change any medication. That is a conversation with your doctor.",
] as const;

export function explainAll(output: EngineOutput): {
headline: string;
findings: string[];
noClearLink: string[];
notEnough: string[];
caveats: string[];
} {
const findings=output.results.filter(
(r) => r.label === "linked_more" || r.label === "linked_fewer",
);
const noClear=output.results.filter((r) => r.label === "no_clear_link");
const notEnough=output.results.filter((r) => r.label === "not_enough_data");

let headline: string;
if(output.factorsAssessed === 0){
headline="There is not enough in your diary yet to look at any factor.";
}else if(findings.length === 0){
headline =
`Nothing stood out across the ${output.factorsAssessed} factors there was ` +
`enough data to look at. That is the most common result, and it is a real one.`;
}else if(findings.length === 1){
headline=`One factor stood out of the ${output.factorsAssessed} that could be looked at.`;
}else{
headline=`${findings.length} factors stood out of the ${output.factorsAssessed} that could be looked at.`;
}

return {
headline,
findings: findings.map(explainFactor),
noClearLink: noClear.map(explainFactor),
notEnough: notEnough.map(explainFactor),
caveats: findings.length > 0 ? [...REQUIRED_CAVEATS] : [REQUIRED_CAVEATS[1], REQUIRED_CAVEATS[2]],
};
}
