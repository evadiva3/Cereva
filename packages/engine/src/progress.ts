
import { THRESHOLDS } from "./engine";
import type { EngineOutput } from "./types";

export interface ThresholdProgress {
have: number;
need: number;
fraction: number;
met: boolean;
}

export interface EngineProgress {
loggedDays: ThresholdProgress;
onsets: ThresholdProgress;
blocking: "logged_days" | "onsets" | null;
estimatedDaysRemaining: number | null;
reporting: boolean;
}

function progress(have: number, need: number): ThresholdProgress {
return {
have,
need,
fraction: need > 0 ? Math.min(1, have / need) : 1,
met: have >= need,
};
}

export function engineProgress(output: EngineOutput, observedDays: number): EngineProgress {
const loggedDays=progress(output.loggedDays, THRESHOLDS.minLoggedDays);
const onsets=progress(output.onsets, THRESHOLDS.minOnsets);

const reporting=output.factorsAssessed > 0;

let blocking: EngineProgress["blocking"]=null;
if(!loggedDays.met) blocking = "logged_days";
else if(!onsets.met) blocking = "onsets";

let estimatedDaysRemaining: number | null=null;
if(blocking === "logged_days" && observedDays > 0 && output.loggedDays > 0){
const perDay=output.loggedDays / observedDays;
if(perDay > 0){
estimatedDaysRemaining=Math.ceil((loggedDays.need - loggedDays.have) / perDay);
}
}else if(blocking === "onsets" && observedDays > 0 && output.onsets > 0){
const perDay=output.onsets / observedDays;
if(perDay > 0){
estimatedDaysRemaining=Math.ceil((onsets.need - onsets.have) / perDay);
}
}

return { loggedDays, onsets, blocking, estimatedDaysRemaining, reporting };
}
