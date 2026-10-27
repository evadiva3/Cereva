
import { getDb } from "./index";
import { isLoggable, today } from "@/dates";

export type Headache = "none" | "mild" | "moderate" | "severe";
export type Stress = "low" | "medium" | "high";

export interface DayLog {
localDate: string;
headache: Headache;
attackDay: boolean;
acuteMed: boolean;
alcohol: boolean;
caffeineChange: boolean;
skippedMeal: boolean;
stress: Stress | null;
loggedAt: string;
backfilled: boolean;
}

interface DayLogRow {
local_date: string;
headache: Headache;
attack_day: number;
acute_med: number;
alcohol: number;
caffeine_change: number;
skipped_meal: number;
stress: Stress | null;
logged_at: string;
backfilled: number;
}

function hydrate(row: DayLogRow): DayLog {
return {
localDate: row.local_date,
headache: row.headache,
attackDay: !!row.attack_day,
acuteMed: !!row.acute_med,
alcohol: !!row.alcohol,
caffeineChange: !!row.caffeine_change,
skippedMeal: !!row.skipped_meal,
stress: row.stress,
loggedAt: row.logged_at,
backfilled: !!row.backfilled,
};
}

export type DayLogInput = Omit<DayLog, "loggedAt" | "backfilled">;

export class NotLoggableError extends Error {
constructor(date: string){
super(
`${date} can no longer be logged. You can fill in today and yesterday; ` +
"further back, memory is not reliable enough to be worth recording.",
);
this.name="NotLoggableError";
}
}

export async function saveDayLog(input: DayLogInput): Promise<DayLog> {
if(!isLoggable(input.localDate)) throw new NotLoggableError(input.localDate);

const db=await getDb();
const loggedAt=new Date().toISOString();
const backfilled=input.localDate !== today() ? 1 : 0;

await db.runAsync(
`INSERT INTO day_logs
       (local_date, headache, attack_day, acute_med, alcohol,
        caffeine_change, skipped_meal, stress, logged_at, backfilled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (local_date) DO UPDATE SET
       headache=excluded.headache,
       attack_day=excluded.attack_day,
       acute_med=excluded.acute_med,
       alcohol=excluded.alcohol,
       caffeine_change=excluded.caffeine_change,
       skipped_meal=excluded.skipped_meal,
       stress=excluded.stress,
       logged_at=excluded.logged_at,
       backfilled=excluded.backfilled`,
input.localDate,
input.headache,
input.attackDay ? 1 : 0,
input.acuteMed ? 1 : 0,
input.alcohol ? 1 : 0,
input.caffeineChange ? 1 : 0,
input.skippedMeal ? 1 : 0,
input.stress,
loggedAt,
backfilled,
);

return { ...input, loggedAt, backfilled: !!backfilled };
}

export async function quickMark(date: string, headache: Headache): Promise<DayLog> {
const existing=await getDayLog(date);
return saveDayLog({
localDate: date,
headache,
attackDay: existing?.attackDay ?? headache === "severe",
acuteMed: existing?.acuteMed ?? false,
alcohol: existing?.alcohol ?? false,
caffeineChange: existing?.caffeineChange ?? false,
skippedMeal: existing?.skippedMeal ?? false,
stress: existing?.stress ?? null,
});
}

export async function getDayLog(date: string): Promise<DayLog | null> {
const db=await getDb();
const row=await db.getFirstAsync<DayLogRow>(
"SELECT * FROM day_logs WHERE local_date = ?",
date,
);
return row ? hydrate(row) : null;
}

export async function listDayLogs(start: string, end: string): Promise<DayLog[]> {
const db=await getDb();
const rows=await db.getAllAsync<DayLogRow>(
"SELECT * FROM day_logs WHERE local_date BETWEEN ? AND ? ORDER BY local_date",
start,
end,
);
return rows.map(hydrate);
}

export async function markAttackDay(date: string): Promise<void> {
const db=await getDb();
const now=new Date().toISOString();
await db.runAsync(
`INSERT INTO day_logs
       (local_date, headache, attack_day, acute_med, alcohol,
        caffeine_change, skipped_meal, stress, logged_at, backfilled)
     VALUES (?, 'moderate', 1, 0, 0, 0, 0, NULL, ?, 0)
     ON CONFLICT (local_date) DO UPDATE SET attack_day = 1`,
date,
now,
);
}
