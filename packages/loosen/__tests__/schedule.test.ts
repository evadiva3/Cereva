
import {
applyReEntryChoice,
countCompletedShortSessions,
DEFAULT_PLAN,
DEFAULT_WEEKLY_TARGET,
describeTensionDrop,
HEAVY_WEEK_ATTACK_DAYS,
longSessionUnlocked,
LONG_SESSION_UNLOCK_AFTER,
makeUpAvailable,
reEntryOffer,
reminderText,
tensionDrop,
weekStatus,
type SessionRecord,
type WeekStatus,
} from "../src/schedule";

const session=(localDate: string, completed=true, lengthSeconds=300): SessionRecord => ({
localDate,
completed,
lengthSeconds,
});

const week=(over: Partial<Parameters<typeof weekStatus>[0]>={}) =>
weekStatus({
weekStart: "2026-03-08",
sessions: [],
attackDates: [],
target: DEFAULT_WEEKLY_TARGET,
...over,
});

describe("weekStatus", () => {
it("meets the target when enough sessions are done", () => {
const status=week({ sessions: [session("2026-03-09"), session("2026-03-11")] });
expect(status.outcome).toBe("met");
expect(status.label).toBe("This week: 2 of 2");
});

it("is below target when short, with no language implying failure", () => {
const status=week({ sessions: [session("2026-03-09")] });
expect(status.outcome).toBe("below");
expect(status.label).toBe("This week: 1 of 2");
expect(status.label).not.toMatch(/miss|fail|behind|streak/i);
});

it("does not count incomplete sessions", () => {
const status=week({ sessions: [session("2026-03-09", false), session("2026-03-10", false)] });
expect(status.completed).toBe(0);
expect(status.outcome).toBe("below");
});

it("counts a day with two sessions as two", () => {
const status=week({ sessions: [session("2026-03-09"), session("2026-03-09")] });
expect(status.completed).toBe(2);
expect(status.outcome).toBe("met");
});
});

describe("attack days reduce what the week asks", () => {
it("takes one session off the target per attack day", () => {
const status=week({ attackDates: ["2026-03-09"], sessions: [session("2026-03-11")] });
expect(status.effectiveTarget).toBe(1);
expect(status.outcome).toBe("met");
expect(status.label).toBe("This week: 1 of 1");
});

it("asks for nothing when attack days equal the target", () => {
const status=week({ attackDates: ["2026-03-09", "2026-03-10"] });
expect(status.effectiveTarget).toBe(0);
expect(status.outcome).toBe("met");
expect(status.label).toBe("This week: nothing asked of you");
});

it("never produces a negative target", () => {
const status=week({
attackDates: ["2026-03-09", "2026-03-10", "2026-03-11", "2026-03-12", "2026-03-13"],
});
expect(status.effectiveTarget).toBe(0);
});

it("counts a duplicated attack date once", () => {
const status=week({ attackDates: ["2026-03-09", "2026-03-09"] });
expect(status.attackDays).toBe(1);
});

it("shows a heavy week neutrally rather than as missed", () => {
const status=week({ attackDates: ["2026-03-09", "2026-03-10", "2026-03-11"] });
expect(status.attackDays).toBeGreaterThanOrEqual(HEAVY_WEEK_ATTACK_DAYS);
expect(status.outcome).toBe("heavy");
});

it("states the reduction as a fact without comment", () => {
const status=week({ attackDates: ["2026-03-09"] });
expect(status.note).toBe("1 attack day this week, so the target came down from 2.");
expect(status.note).not.toMatch(/sorry|unfortunately|but|should|try/i);
});

it("pluralizes correctly", () => {
expect(week({ attackDates: ["2026-03-09"] }).note).toContain("1 attack day ");
expect(week({ attackDates: ["2026-03-09", "2026-03-10"] }).note).toContain("2 attack days ");
});

it("says nothing when there were no attack days", () => {
expect(week().note).toBeNull();
});
});

describe("re-entry offer", () => {
const belowWeek=(weekStart: string): WeekStatus =>
weekStatus({ weekStart, sessions: [], attackDates: [], target: 2 });
const metWeek=(weekStart: string): WeekStatus =>
weekStatus({
weekStart,
sessions: [session(weekStart), session(weekStart)],
attackDates: [],
target: 2,
});
const heavyWeek=(weekStart: string): WeekStatus =>
weekStatus({
weekStart,
sessions: [],
attackDates: [`${weekStart}`, "2026-01-02", "2026-01-03"],
target: 2,
});

it("does not fire after a single quiet week", () => {
expect(reEntryOffer([metWeek("2026-03-01"), belowWeek("2026-03-08")]).needed).toBe(false);
});

it("fires after two consecutive below-target weeks", () => {
const offer=reEntryOffer([
metWeek("2026-03-01"),
belowWeek("2026-03-08"),
belowWeek("2026-03-15"),
]);
expect(offer.needed).toBe(true);
expect(offer.reason).toBe("two_below_target_weeks");
expect(offer.weeks).toEqual(["2026-03-08", "2026-03-15"]);
});

it("does not fire when a met week interrupts the run", () => {
expect(
reEntryOffer([belowWeek("2026-03-01"), metWeek("2026-03-08"), belowWeek("2026-03-15")]).needed,
).toBe(false);
});

it("ignores heavy weeks entirely rather than counting them as below", () => {
const offer=reEntryOffer([
metWeek("2026-03-01"),
heavyWeek("2026-03-08"),
heavyWeek("2026-03-15"),
heavyWeek("2026-03-22"),
]);
expect(offer.needed).toBe(false);
});

it("looks through a heavy week to the below-target weeks around it", () => {
const offer=reEntryOffer([
belowWeek("2026-03-01"),
heavyWeek("2026-03-08"),
belowWeek("2026-03-15"),
]);
expect(offer.needed).toBe(true);
expect(offer.weeks).toEqual(["2026-03-01", "2026-03-15"]);
});

it("does not fire on an empty history", () => {
expect(reEntryOffer([]).needed).toBe(false);
});
});

describe("re-entry choices", () => {
it("reducing the target goes to one, never zero", () => {
const reduced=applyReEntryChoice(DEFAULT_PLAN, "reduce_target");
expect(reduced.weeklyTarget).toBe(1);
});

it("reducing never raises an already lower target", () => {
const plan={ ...DEFAULT_PLAN, weeklyTarget: 1 };
expect(applyReEntryChoice(plan, "reduce_target").weeklyTarget).toBe(1);
});

it("changing the cue clears the old cue and its reminder", () => {
const plan={ ...DEFAULT_PLAN, cue: "I brush my teeth", reminderTime: "21:30" };
const next=applyReEntryChoice(plan, "change_cue");
expect(next.cue).toBeNull();
expect(next.reminderTime).toBeNull();
expect(next.weeklyTarget).toBe(plan.weeklyTarget);
});

it("keeping the plan changes nothing", () => {
const plan={ ...DEFAULT_PLAN, cue: "lunch", weeklyTarget: 2 };
expect(applyReEntryChoice(plan, "keep_plan")).toEqual(plan);
});
});

describe("make-up slot", () => {
const met=weekStatus({ weekStart: "a", sessions: [session("a"), session("a")], attackDates: [], target: 2 });
const below=weekStatus({ weekStart: "b", sessions: [], attackDates: [], target: 2 });

it("is not offered when last week was met", () => {
expect(makeUpAvailable(met, below)).toBe(false);
});

it("is offered once this week's own target is done", () => {
expect(makeUpAvailable(below, met)).toBe(true);
});

it("is not offered while this week is still short", () => {
expect(makeUpAvailable(below, below)).toBe(false);
});

it("is not offered with no history", () => {
expect(makeUpAvailable(null, met)).toBe(false);
});
});

describe("long session unlock", () => {
it("stays locked below the threshold", () => {
for(let n = 0; n < LONG_SESSION_UNLOCK_AFTER; n++){
expect(longSessionUnlocked(n)).toBe(false);
}
});

it("unlocks at the threshold and stays unlocked", () => {
expect(longSessionUnlocked(LONG_SESSION_UNLOCK_AFTER)).toBe(true);
expect(longSessionUnlocked(LONG_SESSION_UNLOCK_AFTER + 10)).toBe(true);
});

it("counts only completed short sessions", () => {
const sessions=[
session("2026-03-01", true, 300),
session("2026-03-02", false, 300),
session("2026-03-03", true, 900),
session("2026-03-04", true, 300),
];
expect(countCompletedShortSessions(sessions)).toBe(2);
});
});

describe("reminder text", () => {
it("quotes the person's own cue back", () => {
const plan={ ...DEFAULT_PLAN, cue: "I put the kettle on" };
expect(reminderText(plan)).toBe("After I put the kettle on, your 5 minutes.");
});

it("works without a cue", () => {
expect(reminderText(DEFAULT_PLAN)).toBe("Your 5 minutes, whenever suits.");
});

it("never nags", () => {
for(const plan of [DEFAULT_PLAN, { ...DEFAULT_PLAN, cue: "lunch" }]){
const text=reminderText(plan);
expect(text).not.toMatch(/don't forget|haven't|missed|streak|keep it up|still time/i);
expect(text).not.toMatch(/!/);
}
});

it("reflects a longer session length", () => {
const plan={ ...DEFAULT_PLAN, sessionSeconds: 900, cue: "dinner" };
expect(reminderText(plan)).toContain("15 minutes");
});
});

describe("tension change", () => {
it("is positive when tension went down", () => {
expect(tensionDrop(7, 3)).toBe(4);
expect(describeTensionDrop(4)).toBe("Tension down 4 of 10.");
});

it("distinguishes no change from not measured", () => {
expect(tensionDrop(5, 5)).toBe(0);
expect(tensionDrop(5, null)).toBeNull();
expect(tensionDrop(null, 5)).toBeNull();
expect(describeTensionDrop(0)).toBe("Tension unchanged.");
expect(describeTensionDrop(null)).toBe("");
});

it("reports an increase without judgement", () => {
expect(tensionDrop(3, 6)).toBe(-3);
const text=describeTensionDrop(-3);
expect(text).toBe("Tension up 3 of 10.");
expect(text).not.toMatch(/sorry|unfortunately|worse|failed/i);
});
});

describe("copy discipline", () => {
it("never mentions streaks anywhere in generated text", () => {
const texts=[
week().label,
week({ attackDates: ["2026-03-09"] }).note ?? "",
reminderText({ ...DEFAULT_PLAN, cue: "lunch" }),
describeTensionDrop(2),
describeTensionDrop(-2),
];
for(const text of texts){
expect(text).not.toMatch(/streak|in a row|consecutive|don't break/i);
expect(text).not.toMatch(/!/);
}
});
});
