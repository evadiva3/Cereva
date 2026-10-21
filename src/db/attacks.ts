
import { getDb } from "./index";
import { markAttackDay } from "./dayLogs";
import { localDate } from "@/dates";

export type AuraAnswer = "yes" | "no" | "unsure";
export type Severity = "mild" | "moderate" | "severe";

export interface Attack {
id: string;
startedAt: string;
localDate: string;
endedAt: string | null;
aura: AuraAnswer;
meds: boolean;
severity: Severity | null;
voiceNotePath: string | null;
note: string | null;
}

interface AttackRow {
id: string;
started_at: string;
local_date: string;
ended_at: string | null;
aura: AuraAnswer;
meds: number;
severity: Severity | null;
voice_note_path: string | null;
note: string | null;
}

function hydrate(row: AttackRow): Attack {
return {
id: row.id,
startedAt: row.started_at,
localDate: row.local_date,
endedAt: row.ended_at,
aura: row.aura,
meds: !!row.meds,
severity: row.severity,
voiceNotePath: row.voice_note_path,
note: row.note,
};
}

function newId(): string {
const t=Date.now().toString(36);
const r=Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, "0");
return `atk_${t}_${r}`;
}

export async function startAttack(): Promise<Attack> {
const db=await getDb();
const now=new Date();
const attack: Attack={
id: newId(),
startedAt: now.toISOString(),
localDate: localDate(now),
endedAt: null,
aura: "unsure",
meds: false,
severity: null,
voiceNotePath: null,
note: null,
};

await db.runAsync(
`INSERT INTO attacks
       (id, started_at, local_date, ended_at, aura, meds, severity, voice_note_path, note)
     VALUES (?, ?, ?, NULL, ?, 0, NULL, NULL, NULL)`,
attack.id,
attack.startedAt,
attack.localDate,
attack.aura,
);

await markAttackDay(attack.localDate);
return attack;
}

export interface AttackUpdate {
aura?: AuraAnswer;
meds?: boolean;
severity?: Severity | null;
voiceNotePath?: string | null;
note?: string | null;
endedAt?: string | null;
}

export async function updateAttack(id: string, patch: AttackUpdate): Promise<void> {
const columns: Record<keyof AttackUpdate, string>={
aura: "aura",
meds: "meds",
severity: "severity",
voiceNotePath: "voice_note_path",
note: "note",
endedAt: "ended_at",
};

const sets: string[]=[];
const values: (string | number | null)[]=[];
for(const [key, column] of Object.entries(columns) as [keyof AttackUpdate, string][]){
const value=patch[key];
if(value === undefined) continue;
sets.push(`${column} = ?`);
values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
}
if(sets.length === 0) return;

const db=await getDb();
await db.runAsync(`UPDATE attacks SET ${sets.join(", ")} WHERE id = ?`, ...values, id);
}

export async function openAttack(): Promise<Attack | null> {
const db=await getDb();
const row=await db.getFirstAsync<AttackRow>(
"SELECT * FROM attacks WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1",
);
return row ? hydrate(row) : null;
}

export async function endAttack(id: string): Promise<void> {
await updateAttack(id, { endedAt: new Date().toISOString() });
}

export async function getAttack(id: string): Promise<Attack | null> {
const db=await getDb();
const row=await db.getFirstAsync<AttackRow>("SELECT * FROM attacks WHERE id = ?", id);
return row ? hydrate(row) : null;
}

export async function listAttacks(limit = 200): Promise<Attack[]> {
const db=await getDb();
const rows=await db.getAllAsync<AttackRow>(
"SELECT * FROM attacks ORDER BY started_at DESC LIMIT ?",
limit,
);
return rows.map(hydrate);
}

export async function deleteAttack(id: string): Promise<string | null> {
const db=await getDb();
const row=await db.getFirstAsync<{ voice_note_path: string | null }>(
"SELECT voice_note_path FROM attacks WHERE id = ?",
id,
);
await db.runAsync("DELETE FROM attacks WHERE id = ?", id);
return row?.voice_note_path ?? null;
}

export async function attacksPerMonth(): Promise<{ month: string; attacks: number }[]> {
const db=await getDb();
return db.getAllAsync<{ month: string; attacks: number }>(
`SELECT substr(local_date, 1, 7) AS month, COUNT(*) AS attacks
       FROM attacks
      GROUP BY month
      ORDER BY month DESC`,
);
}
