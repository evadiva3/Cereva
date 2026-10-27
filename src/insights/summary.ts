import type { DayRecord } from "../../packages/engine/src/types";

export function summarizeDays(days:DayRecord[]){
const logged=days.filter(day => day.logged);
const counts=[0,0,0,0,0];
for(const day of logged){
const level=day.severity;
const index=level !== null && Number.isInteger(level) && level>=0 && level<=3 ? level : 4;
counts[index]=(counts[index] ?? 0)+1;
}
const sleep=logged.flatMap(day => day.sleepMinutes !== null && Number.isFinite(day.sleepMinutes) ? [day.sleepMinutes] : []);
return {
logged:logged.length,
attackDays:logged.filter(day => day.attack).length,
counts,
averageSleep:sleep.length ? sleep.reduce((sum,value) => sum+value,0)/sleep.length : null,
};
}

export function routineComparisons(days:DayRecord[]){
const factors:{label:string;withLabel:string;withoutLabel:string;read:(day:DayRecord)=>boolean | null}[]=[
{label:"Sleep",withLabel:"Under 6 hours",withoutLabel:"6 hours or more",read:day=>day.sleepMinutes === null ? null : day.sleepMinutes<360},
{label:"Stress",withLabel:"High stress",withoutLabel:"Low / medium stress",read:day=>day.stress === null ? null : day.stress===2},
{label:"Meals",withLabel:"Skipped a meal",withoutLabel:"No skipped meal",read:day=>day.skippedMeal},
];
return factors.flatMap(factor=>{
const observed=days.filter(day=>day.logged && day.severity !== null && factor.read(day) !== null);
const withDays=observed.filter(day=>factor.read(day));
const withoutDays=observed.filter(day=>!factor.read(day));
if(withDays.length<5 || withoutDays.length<5) return [];
return [{label:factor.label,withLabel:factor.withLabel,withoutLabel:factor.withoutLabel,
withCount:withDays.length,withoutCount:withoutDays.length,
withPain:withDays.filter(day=>day.severity!>=2).length,withoutPain:withoutDays.filter(day=>day.severity!>=2).length}];
});
}
