
import * as SQLite from "expo-sqlite";
import { LATEST_VERSION, MIGRATIONS } from "./migrations";

const DB_NAME="scintilla.db";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null=null;

export class SchemaTooNewError extends Error {
constructor(found: number, known: number){
super(
`This database was written by a newer version of Scintilla ` +
`(schema ${found}, this build knows ${known}). Update the app to open it.`,
);
this.name="SchemaTooNewError";
}
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
await db.execAsync("PRAGMA journal_mode = WAL");
await db.execAsync("PRAGMA foreign_keys = ON");

const row=await db.getFirstAsync<{ user_version: number }>(
"PRAGMA user_version",
);
const cur=row?.user_version ?? 0;

if(cur > LATEST_VERSION){
throw new SchemaTooNewError(cur, LATEST_VERSION);
}
if(cur === LATEST_VERSION) return;

const pending=MIGRATIONS.filter((m) => m.version > cur).sort(
(a, b) => a.version - b.version,
);

await db.withExclusiveTransactionAsync(async (tx) => {
for(const m of pending){
for(const sql of m.statements){
await tx.execAsync(sql);
}
await tx.execAsync(`PRAGMA user_version = ${m.version}`);
}
});

await ensureSettingsRow(db);
}

async function ensureSettingsRow(db: SQLite.SQLiteDatabase): Promise<void> {
const now=new Date().toISOString();
await db.runAsync(
`INSERT INTO settings (id, created_at, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT (id) DO NOTHING`,
now,
now,
);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
if(!dbPromise){
dbPromise=(async () => {
const db=await SQLite.openDatabaseAsync(DB_NAME);
await migrate(db);
return db;
})().catch((err) => {
dbPromise=null;
throw err;
});
}
return dbPromise;
}

export async function deleteAllRows(): Promise<void> {
const db=await getDb();
const tables=[
"events",
"engine_runs",
"loosen_sessions",
"passive_daily",
"attacks",
"day_logs",
"aura_versions",
"settings",
];
await db.withExclusiveTransactionAsync(async (tx) => {
for(const t of tables){
await tx.execAsync(`DELETE FROM ${t}`);
}
await tx.execAsync("DELETE FROM sqlite_sequence");
});
await ensureSettingsRow(db);
}

export function resetConnectionForTests(): void {
dbPromise=null;
}

export { LATEST_VERSION };
