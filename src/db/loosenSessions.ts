
import { getDb } from "./index";
import { addDays, deviceWeekStart, localDate, startOfWeek, today } from "@/dates";
import {
DEFAULT_PLAN,
countCompletedShortSessions,
longSessionUnlocked,
reEntryOffer,
weekStatus,
type LoosenPlan,
type ReEntryOffer,
type SessionRecord,
type WeekStatus,
} from "../../packages/loosen/src/schedule";

export interface LoosenSession {
id: string;
startedAt: string;
localDate: string;
lengthSeconds: number;
playedFraction: number;
completed: boolean;
source: string;
tensionBefore: number | null;
tensionAfter: number | null;
}

interface SessionRow {
id: string;
started_at: string;
local_date: string;
length_s: number;
played_fraction: number;
completed: number;
source: string;
tension_before: number | null;
tension_after: number | null;
}

function hydrate(row: SessionRow): LoosenSession {
return {
id: row.id,
startedAt: row.started_at,
localDate: row.local_date,
lengthSeconds: row.length_s,
playedFraction: row.played_fraction,
completed: !!row.completed,
source: row.source,
tensionBefore: row.tension_before,
tensionAfter: row.tension_after,
};
}

function newId(): string {
const t=Date.now().toString(36);
const r=Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, "0");
return `lsn_${t}_${r}`;
}

export async function startSession(
lengthSeconds: number,
tensionBefore: number | null,
source="manual",
): Promise<LoosenSession> {
const db=await getDb();
const now=new Date();
const session: LoosenSession={
id: newId(),
startedAt: now.toISOString(),
localDate: localDate(now),
lengthSeconds,
playedFraction: 0,
completed: false,
source,
tensionBefore,
tensionAfter: null,
};
await db.runAsync(
`INSERT INTO loosen_sessions
       (id, started_at, local_date, length_s, played_fraction, completed,
        source, tension_before, tension_after)
     VALUES (?, ?, ?, ?, 0, 0, ?, ?, NULL)`,
session.id,
session.startedAt,
session.localDate,
session.lengthSeconds,
session.source,
session.tensionBefore,
);
return session;
}

export async function finishSession(
id: string,
playedFraction: number,
completed: boolean,
tensionAfter: number | null,
): Promise<void> {
const db=await getDb();
await db.runAsync(
`UPDATE loosen_sessions
        SET played_fraction = ?, completed = ?, tension_after = ?
      WHERE id = ?`,
Math.min(1, Math.max(0, playedFraction)),
completed ? 1 : 0,
tensionAfter,
id,
);
}

export async function listSessions(start: string, end: string): Promise<LoosenSession[]> {
const db=await getDb();
const rows=await db.getAllAsync<SessionRow>(
"SELECT * FROM loosen_sessions WHERE local_date BETWEEN ? AND ? ORDER BY started_at",
start,
end,
);
return rows.map(hydrate);
}

export async function allSessions(): Promise<LoosenSession[]> {
const db=await getDb();
const rows=await db.getAllAsync<SessionRow>(
"SELECT * FROM loosen_sessions ORDER BY started_at",
);
return rows.map(hydrate);
}

export async function getPlan(): Promise<LoosenPlan> {
const db=await getDb();
const row=await db.getFirstAsync<{
loosen_sessions_target: number;
loosen_session_length_s: number;
loosen_long_unlocked: number;
loosen_cue: string | null;
loosen_reminder_time: string | null;
}>(
`SELECT loosen_sessions_target, loosen_session_length_s,
            loosen_long_unlocked, loosen_cue, loosen_reminder_time
       FROM settings WHERE id = 1`,
);
if(!row) return { ...DEFAULT_PLAN };
return {
weeklyTarget: row.loosen_sessions_target,
sessionSeconds: row.loosen_session_length_s,
longUnlocked: !!row.loosen_long_unlocked,
cue: row.loosen_cue,
reminderTime: row.loosen_reminder_time,
};
}

export async function savePlan(plan: LoosenPlan): Promise<void> {
const db=await getDb();
await db.runAsync(
`UPDATE settings
        SET loosen_sessions_target = ?,
            loosen_session_length_s=?,
            loosen_long_unlocked=?,
            loosen_cue=?,
            loosen_reminder_time=?,
            updated_at=?
      WHERE id = 1`,
plan.weeklyTarget,
plan.sessionSeconds,
plan.longUnlocked ? 1 : 0,
plan.cue,
plan.reminderTime,
new Date().toISOString(),
);
}

export interface LoosenOverview {
plan: LoosenPlan;
thisWeek: WeekStatus;
recentWeeks: WeekStatus[];
reEntry: ReEntryOffer;
longUnlocked: boolean;
completedShortSessions: number;
}

export async function loosenOverview(weeksBack = 8): Promise<LoosenOverview> {
const db=await getDb();
const plan=await getPlan();
const weekStart=deviceWeekStart();

const wkStart=startOfWeek(today(), weekStart);
const earliest=addDays(wkStart, -7 * weeksBack);

const sessions=await listSessions(earliest, today());
const attackRows=await db.getAllAsync<{ local_date: string }>(
"SELECT local_date FROM day_logs WHERE attack_day = 1 AND local_date BETWEEN ? AND ?",
earliest,
today(),
);

const byWeek=new Map<string, { sessions: SessionRecord[]; attackDates: string[] }>();
const bucket=(date: string) => {
const key=startOfWeek(date, weekStart);
let entry=byWeek.get(key);
if(!entry){
entry={ sessions: [], attackDates: [] };
byWeek.set(key, entry);
}
return entry;
};

for(const s of sessions){
bucket(s.localDate).sessions.push({
localDate: s.localDate,
completed: s.completed,
lengthSeconds: s.lengthSeconds,
});
}
for(const row of attackRows){
bucket(row.local_date).attackDates.push(row.local_date);
}

const weeks: WeekStatus[]=[];
for(let i = weeksBack; i >= 0; i--){
const start=addDays(wkStart, -7 * i);
const entry=byWeek.get(start) ?? { sessions: [], attackDates: [] };
weeks.push(
weekStatus({
weekStart: start,
sessions: entry.sessions,
attackDates: entry.attackDates,
target: plan.weeklyTarget,
}),
);
}

const thisWeek=weeks[weeks.length - 1]!;
const settled=weeks.slice(0, -1);

const everySession=await allSessions();
const completedShort=countCompletedShortSessions(
everySession.map((s) => ({
localDate: s.localDate,
completed: s.completed,
lengthSeconds: s.lengthSeconds,
})),
);

return {
plan,
thisWeek,
recentWeeks: weeks,
reEntry: reEntryOffer(settled),
longUnlocked: plan.longUnlocked || longSessionUnlocked(completedShort),
completedShortSessions: completedShort,
};
}
