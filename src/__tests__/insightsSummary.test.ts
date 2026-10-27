import { summarizeDays } from "../insights/summary";
import type { DayRecord } from "../../packages/engine/src/types";
function day(patch:Partial<DayRecord>):DayRecord{
return {date:"2026-10-25",logged:true,attack:false,severity:null,alcohol:null,caffeineChange:null,skippedMeal:null,stress:null,sleepMinutes:null,steps:null,menstruating:null,pressureChange:null,tempChange:null,humidity:null,loosenSession:false,...patch};
}
it("keeps missing levels separate from days with no pain",() => {
const result=summarizeDays([day({severity:0}),day({severity:1}),day({severity:2}),day({severity:3,attack:true}),day({severity:null,attack:true}),day({severity:3,logged:false})]);
expect(result.counts).toEqual([1,1,1,1,1]);
expect(result.logged).toBe(5);
expect(result.attackDays).toBe(2);
});
it("averages only observed sleep on logged days",() => {
expect(summarizeDays([day({sleepMinutes:360}),day({sleepMinutes:null}),day({sleepMinutes:480}),day({logged:false,sleepMinutes:100})]).averageSleep).toBe(420);
});
it("does not invent percentages or sleep for an empty diary",() => {
expect(summarizeDays([])).toEqual({logged:0,attackDays:0,counts:[0,0,0,0,0],averageSleep:null});
});

import { routineComparisons } from "../insights/summary";
it("compares only logged observations with known exposure and severity",()=>{
const records=[...Array.from({length:5},()=>day({severity:3,stress:2})),...Array.from({length:5},()=>day({severity:1,stress:0})),day({severity:3,stress:null}),day({severity:null,stress:2}),day({severity:3,stress:0,logged:false})];
expect(routineComparisons(records)).toEqual([expect.objectContaining({label:"Stress",withCount:5,withoutCount:5,withPain:5,withoutPain:0})]);
expect(routineComparisons(records.slice(1))).toEqual([]);
});
