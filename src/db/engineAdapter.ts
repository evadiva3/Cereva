
import type { DayRecord } from "../../packages/engine/src/types";
import { addDays, dateRange, today } from "@/dates";
import { getDb } from "./index";

const DEFAULT_WINDOW_DAYS=730;

interface DayLogRow {
local_date: string;
headache: string;
attack_day: number;
alcohol: number;
caffeine_change: number;
skipped_meal: number;
stress: string | null;
}

interface PassiveRow {
local_date: string;
sleep_minutes: number | null;
steps: number | null;
menstrual_flow: string | null;
pressure_change: number | null;
temp_change: number | null;
humidity: number | null;
}

const HEADACHE_VALUES: Record<string, number>={ none: 0, mild: 1, moderate: 2, severe: 3 };

const STRESS_VALUES: Record<string, number>={ low: 0, medium: 1, high: 2 };

export async function buildEngineInput(windowDays = DEFAULT_WINDOW_DAYS): Promise<DayRecord[]> {
const db=await getDb();
const end=today();
const windowStart=addDays(end, -(windowDays - 1));

const earliest=await db.getFirstAsync<{ d: string | null }>(
`SELECT MIN(d) AS d FROM (
       SELECT MIN(local_date) AS d FROM day_logs
       UNION ALL SELECT MIN(local_date) FROM attacks
       UNION ALL SELECT MIN(local_date) FROM passive_daily
     )`,
);
if(!earliest?.d) return [];

const start=earliest.d > windowStart ? earliest.d : windowStart;

const [logs, passive, attackDates, loosenDates]=await Promise.all([
db.getAllAsync<DayLogRow>(
`SELECT local_date, headache, attack_day, alcohol, caffeine_change,
              skipped_meal, stress
         FROM day_logs WHERE local_date BETWEEN ? AND ?`,
start,
end,
),
db.getAllAsync<PassiveRow>(
`SELECT local_date, sleep_minutes, steps, menstrual_flow,
              pressure_change, temp_change, humidity
         FROM passive_daily WHERE local_date BETWEEN ? AND ?`,
start,
end,
),
db.getAllAsync<{ local_date: string }>(
`SELECT DISTINCT local_date FROM attacks WHERE local_date BETWEEN ? AND ?`,
start,
end,
),
db.getAllAsync<{ local_date: string }>(
`SELECT DISTINCT local_date FROM loosen_sessions
        WHERE completed = 1 AND local_date BETWEEN ? AND ?`,
start,
end,
),
]);

const logByDate=new Map(logs.map((r) => [r.local_date, r]));
const passiveByDate=new Map(passive.map((r) => [r.local_date, r]));
const attackSet=new Set(attackDates.map((r) => r.local_date));
const loosenSet=new Set(loosenDates.map((r) => r.local_date));

return dateRange(start, end).map((date): DayRecord => {
const log=logByDate.get(date);
const p=passiveByDate.get(date);
const attackFromLog=log?.attack_day === 1;
const attackFromRecord=attackSet.has(date);

return {
date,
logged: !!log || attackFromRecord,
attack: attackFromLog || attackFromRecord,
severity: log ? (HEADACHE_VALUES[log.headache] ?? null) : null,
alcohol: log ? log.alcohol === 1 : null,
caffeineChange: log ? log.caffeine_change === 1 : null,
skippedMeal: log ? log.skipped_meal === 1 : null,
stress: log?.stress ? (STRESS_VALUES[log.stress] ?? null) : null,
sleepMinutes: p?.sleep_minutes ?? null,
steps: p?.steps ?? null,
menstruating: p?.menstrual_flow ? true : log ? false : null,
pressureChange: p?.pressure_change ?? null,
tempChange: p?.temp_change ?? null,
humidity: p?.humidity ?? null,
loosenSession: loosenSet.has(date),
};
});
}

export async function saveEngineRun(
windowStart: string,
windowEnd: string,
engineVersion: string,
output: unknown,
): Promise<void> {
const db=await getDb();
const id=`run_${Date.now().toString(36)}`;
await db.runAsync(
`INSERT INTO engine_runs
       (id, run_at, input_window_start, input_window_end, engine_version, output_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
id,
new Date().toISOString(),
windowStart,
windowEnd,
engineVersion,
JSON.stringify(output),
);
}
