
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

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns=Object.keys(rows[0]!);
  const lines=[columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c])).join(","));
  }
  return lines.join("\n");
}

export interface ExportResult {
  uri: string;
  counts: Record<string, number>;
}

function exportDirectory(): Directory {
  const dir=new Directory(Paths.cache, "export");
  if (dir.exists) dir.delete();
  dir.create({ intermediates: true });
  return dir;
}

export async function exportJson(): Promise<ExportResult> {
  const dir=exportDirectory();
  const pl: Record<string, unknown>={
    exportedAt: new Date().toISOString(),
    app: "Scintilla",
    note:
      "Everything this app holds about you. Health data never left your " +
      "phone; this file is the first time it has.",
    tables: {},
  };
  const counts: Record<string, number>={};
  const tables: Record<string, unknown>={};

  for (const table of TABLES) {
    const rows=await dumpTable(table);
    tables[table]=rows;
    counts[table]=rows.length;
  }
  pl.tables=tables;

  const file=new File(dir, `scintilla-${today()}.json`);
  file.create();
  file.write(JSON.stringify(pl, null, 2));
  return { uri: file.uri, counts };
}

export async function exportCsv(): Promise<ExportResult & { uris: string[] }> {
  const dir=exportDirectory();
  const counts: Record<string, number>={};
  const uris: string[]=[];

  for (const table of TABLES) {
    const rows=await dumpTable(table);
    counts[table]=rows.length;
    if (rows.length === 0) continue;
    const file=new File(dir, `${table}.csv`);
    file.create();
    file.write(toCsv(rows));
    uris.push(file.uri);
  }

  return { uri: uris[0] ?? dir.uri, counts, uris };
}

export async function shareExport(uri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(uri, { dialogTitle: "Your Scintilla data" });
}

export async function deleteEverything(): Promise<void> {
  await deleteAllRows();
  deleteAllAuraImages();
  try {
    const dir=new Directory(Paths.cache, "export");
    if (dir.exists) dir.delete();
  } catch {}
}

export async function dataSummary(): Promise<Record<string, number>> {
  const counts: Record<string, number>={};
  for (const table of TABLES) {
    assertKnownTable(table);
    const db=await getDb();
    const row=await db.getFirstAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
    counts[table]=row?.n ?? 0;
  }
  return counts;
}

export { TABLES };
