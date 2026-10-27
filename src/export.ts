
import * as Sharing from "expo-sharing";
import { Directory, File, Paths } from "expo-file-system";

import { deleteAllRows, getDb } from "./db";
import { deleteAllAuraImages } from "./files";
import { today } from "./dates";

const TABLES=[
"settings",
"day_logs",
"attacks",
"passive_daily",
"loosen_sessions",
"aura_versions",
"engine_runs",
"events",
] as const;

function assertKnownTable(table: string): void {
if(!(TABLES as readonly string[]).includes(table)){
throw new Error(`refusing to query an unknown table: ${table}`);
}
}

async function dumpTable(table: string): Promise<Record<string, unknown>[]> {
assertKnownTable(table);
const db=await getDb();
return db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${table}`);
}

function csvCell(value: unknown): string {
if(value === null || value === undefined) return "";
const s=String(value);
if(/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
return s;
}

function toCsv(rs: Record<string, unknown>[]): string {
if(rs.length === 0) return "";
const cs=Object.keys(rs[0]!);
const ls=[cs.join(",")];
for(const r of rs){
ls.push(cs.map((c) => csvCell(r[c])).join(","));
}
return ls.join("\n");
}

export interface ExportResult {
uri: string;
counts: Record<string, number>;
}

function exportDirectory(): Directory {
const d=new Directory(Paths.cache, "export");
if(d.exists) d.delete();
d.create({ intermediates: true });
return d;
}

export async function exportJson(): Promise<ExportResult> {
const d=exportDirectory();
const pl: Record<string, unknown>={
exportedAt: new Date().toISOString(),
app: "Cereva",
note:
"Everything this app holds about you. Health data never left your " +
"phone; this file is the first time it has.",
tables: {},
};
const cn: Record<string, number>={};
const ts: Record<string, unknown>={};

for(const t of TABLES){
const rs=await dumpTable(t);
ts[t]=rs;
cn[t]=rs.length;
}
pl.tables=ts;

const f=new File(d, `cereva-${today()}.json`);
f.create();
f.write(JSON.stringify(pl, null, 2));
return { uri: f.uri, counts: cn };
}

export async function exportCsv(): Promise<ExportResult & { uris: string[] }> {
const d=exportDirectory();
const cn: Record<string, number>={};
const us: string[]=[];

for(const t of TABLES){
const rs=await dumpTable(t);
cn[t]=rs.length;
if(rs.length === 0) continue;
const f=new File(d, `${t}.csv`);
f.create();
f.write(toCsv(rs));
us.push(f.uri);
}

return { uri: us[0] ?? d.uri, counts: cn, uris: us };
}

export async function shareExport(uri: string): Promise<void> {
if(!(await Sharing.isAvailableAsync())){
throw new Error("Sharing is not available on this device.");
}
await Sharing.shareAsync(uri, { dialogTitle: "Your Cereva data" });
}

export async function deleteEverything(): Promise<void> {
await deleteAllRows();
deleteAllAuraImages();
try {
const d=new Directory(Paths.cache, "export");
if(d.exists) d.delete();
} catch {}
}

export async function dataSummary(): Promise<Record<string, number>> {
const cn: Record<string, number>={};
for(const t of TABLES){
assertKnownTable(t);
const db=await getDb();
const r=await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`);
cn[t]=r?.n ?? 0;
}
return cn;
}

export { TABLES };
