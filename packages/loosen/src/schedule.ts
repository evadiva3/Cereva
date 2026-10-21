
export const DEFAULT_WEEKLY_TARGET=2;
export const DEFAULT_SESSION_SECONDS=300;
export const LONG_SESSION_SECONDS=900;

export const LONG_SESSION_UNLOCK_AFTER=4;

export const HEAVY_WEEK_ATTACK_DAYS=3;

export const RE_ENTRY_AFTER_WEEKS=2;

export interface SessionRecord {
localDate: string;
completed: boolean;
lengthSeconds: number;
}

export interface WeekInput {
weekStart: string;
sessions: SessionRecord[];
attackDates: string[];
target: number;
}

export type WeekOutcome = "met" | "below" | "heavy" | "future";

export interface WeekStatus {
weekStart: string;
target: number;
effectiveTarget: number;
completed: number;
attackDays: number;
outcome: WeekOutcome;
label: string;
note: string | null;
}

export function weekStatus(input: WeekInput): WeekStatus {
const completed=input.sessions.filter((s) => s.completed).length;
const attackDays=new Set(input.attackDates).size;
const target=Math.max(0, input.target);
const effectiveTarget=Math.max(0, target - attackDays);

let outcome: WeekOutcome;
if(attackDays >= HEAVY_WEEK_ATTACK_DAYS){
outcome="heavy";
}else if(completed >= effectiveTarget){
outcome="met";
}else{
outcome="below";
}

const label =
effectiveTarget === 0
? completed === 0
? "This week: nothing asked of you"
: `This week: ${completed} done`
: `This week: ${completed} of ${effectiveTarget}`;

let note: string | null=null;
if(attackDays > 0 && effectiveTarget < target){
const dayWord=attackDays === 1 ? "attack day" : "attack days";
note=`${attackDays} ${dayWord} this week, so the target came down from ${target}.`;
}else if(attackDays > 0){
const dayWord=attackDays === 1 ? "attack day" : "attack days";
note=`${attackDays} ${dayWord} this week.`;
}

return { weekStart: input.weekStart, target, effectiveTarget, completed, attackDays, outcome, label, note };
}

export function makeUpAvailable(previous: WeekStatus | null, current: WeekStatus): boolean {
if(!previous) return false;
if(previous.outcome === "met") return false;
return current.completed >= current.effectiveTarget;
}

export type ReEntryReason = "two_below_target_weeks";

export interface ReEntryOffer {
needed: boolean;
reason: ReEntryReason | null;
weeks: string[];
}

export function reEntryOffer(recentWeeks: WeekStatus[]): ReEntryOffer {
const considered=recentWeeks.filter((w) => w.outcome !== "heavy" && w.outcome !== "future");
const trailing: WeekStatus[]=[];
for(let i = considered.length - 1; i >= 0; i--){
const week=considered[i]!;
if(week.outcome === "below") trailing.unshift(week);
else break;
}

if(trailing.length >= RE_ENTRY_AFTER_WEEKS){
return {
needed: true,
reason: "two_below_target_weeks",
weeks: trailing.map((w) => w.weekStart),
};
}
return { needed: false, reason: null, weeks: [] };
}

export type ReEntryChoice = "change_cue" | "reduce_target" | "keep_plan";

export interface LoosenPlan {
weeklyTarget: number;
sessionSeconds: number;
longUnlocked: boolean;
cue: string | null;
reminderTime: string | null;
}

export const DEFAULT_PLAN: LoosenPlan={
weeklyTarget: DEFAULT_WEEKLY_TARGET,
sessionSeconds: DEFAULT_SESSION_SECONDS,
longUnlocked: false,
cue: null,
reminderTime: null,
};

export function applyReEntryChoice(plan: LoosenPlan, choice: ReEntryChoice): LoosenPlan {
switch(choice){
case "reduce_target":
return { ...plan, weeklyTarget: Math.min(plan.weeklyTarget, 1) };
case "change_cue":
return { ...plan, cue: null, reminderTime: null };
case "keep_plan":
return plan;
}
}

export function longSessionUnlocked(completedShortSessions: number): boolean {
return completedShortSessions >= LONG_SESSION_UNLOCK_AFTER;
}

export function countCompletedShortSessions(sessions: SessionRecord[]): number {
return sessions.filter((s) => s.completed && s.lengthSeconds <= DEFAULT_SESSION_SECONDS).length;
}

export function reminderText(plan: LoosenPlan): string {
if(plan.cue && plan.cue.trim().length > 0){
return `After ${plan.cue.trim()}, your ${Math.round(plan.sessionSeconds / 60)} minutes.`;
}
return `Your ${Math.round(plan.sessionSeconds / 60)} minutes, whenever suits.`;
}

export function tensionDrop(before: number | null, after: number | null): number | null {
if(before === null || after === null) return null;
if(!Number.isFinite(before) || !Number.isFinite(after)) return null;
return before - after;
}

export function describeTensionDrop(drop: number | null): string {
if(drop === null) return "";
if(drop > 0) return `Tension down ${drop} of 10.`;
if(drop === 0) return "Tension unchanged.";
return `Tension up ${Math.abs(drop)} of 10.`;
}
