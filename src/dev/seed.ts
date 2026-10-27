
import { getDb } from "@/db";
import { AURA_PRESETS, normalizeAuraState } from "@aura/schema";
import { addDays, localDate } from "@/dates";

const LEVELS=["none", "mild", "moderate", "severe"] as const;

function rng(seed: number){
let t=seed >>> 0;
return () => {
t=(t + 0x6d2b79f5) >>> 0;
let x=Math.imul(t ^ (t >>> 15), 1 | t);
x=(x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};
}

function normal(rand: () => number, mean: number, sd: number){
const u=Math.max(1e-9, rand());
const v=rand();
return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface SeedResult {
days: number;
attacks: number;
worsenings: number;
}

export async function seedChronic(days=180, seed=23): Promise<SeedResult> {
const db=await getDb();
const rand=rng(seed);
const start=addDays(localDate(), -(days - 1));

await db.execAsync("DELETE FROM attack_readings");
await db.execAsync("DELETE FROM attacks");
await db.execAsync("DELETE FROM day_logs");
await db.execAsync("DELETE FROM passive_daily");

const sleep: number[]=[];
const pressure: number[]=[];
for(let i = 0; i < days; i++){
sleep.push(Math.max(220, Math.min(620, normal(rand, 425, 75))));
pressure.push(normal(rand, 0, 4.5));
}

let severity=1;
let attacks=0;
let worsenings=0;

for(let i = 0; i < days; i++){
const date=addDays(start, i);

const shortLastNight=i > 0 && sleep[i - 1]! < 360;
const bigPressureDrop=pressure[i]! < -5;
const skippedMeal=rand() < 0.28;
const alcohol=rand() < 0.2;
const caffeineChange=rand() < 0.18;
const stress=rand() < 0.28 ? "high" : rand() < 0.5 ? "medium" : "low";

let pressureToWorsen=0.08;
if(shortLastNight) pressureToWorsen += 0.5;
if(bigPressureDrop) pressureToWorsen += 0.28;
if(stress === "high") pressureToWorsen += 0.12;

const before=severity;
if(rand() < pressureToWorsen && severity < 3) severity += 1;
else if(rand() < 0.4 && severity > 1) severity -= 1;
if(severity > before) worsenings++;

const headache=LEVELS[severity]!;
const attackDay=severity >= 1;
const meds=attackDay && rand() < 0.45;

await db.runAsync(
`INSERT OR REPLACE INTO day_logs
 (local_date, headache, attack_day, acute_med, alcohol, caffeine_change,
  skipped_meal, stress, logged_at, backfilled)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
date,
headache,
attackDay ? 1 : 0,
meds ? 1 : 0,
alcohol ? 1 : 0,
caffeineChange ? 1 : 0,
skippedMeal ? 1 : 0,
stress,
`${date}T20:00:00.000Z`,
);

await db.runAsync(
`INSERT OR REPLACE INTO passive_daily
 (local_date, sleep_minutes, steps, pressure_change, temp_change, humidity,
  health_source, weather_source, fetched_at)
 VALUES (?, ?, ?, ?, ?, ?, 'demo', 'demo', ?)`,
date,
Math.round(sleep[i]!),
Math.round(normal(rand, 6200, 2200)),
Number(pressure[i]!.toFixed(2)),
Number(normal(rand, 0, 2.5).toFixed(2)),
Number(normal(rand, 62, 12).toFixed(1)),
`${date}T21:00:00.000Z`,
);

if(attackDay){
const id=`seed_${i}`;
await db.runAsync(
`INSERT OR REPLACE INTO attacks
 (id, started_at, local_date, ended_at, aura, meds, severity, voice_note_path, note)
 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
id,
`${date}T08:00:00.000Z`,
date,
i === days - 1 ? null : `${date}T22:00:00.000Z`,
rand() < 0.4 ? "yes" : "no",
meds ? 1 : 0,
headache === "none" ? null : headache,
);
await db.runAsync(
`INSERT INTO attack_readings (attack_id, at, local_date, severity, note)
 VALUES (?, ?, ?, ?, NULL)`,
id,
`${date}T08:30:00.000Z`,
date,
headache === "none" ? null : headache,
);
if(i === days - 1) await db.runAsync("UPDATE attacks SET continuous = 1 WHERE id = ?", id);
attacks++;
}
}

const preset=AURA_PRESETS.find((p) => p.id === "shimmering_arc") ?? AURA_PRESETS[1] ?? AURA_PRESETS[0]!;
const { state }=normalizeAuraState(preset.input);
await db.execAsync("DELETE FROM aura_versions");
await db.runAsync(
`INSERT INTO aura_versions
 (id, name, created_at, schema_version, state_json, background_type,
  source_text, ai_draft_json, ai_model, ai_warnings_json, thumbnail_path)
 VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL)`,
"seed_aura",
preset.name,
new Date().toISOString(),
1,
JSON.stringify(state),
"neutral",
);

await db.runAsync("UPDATE settings SET display_name = COALESCE(NULLIF(display_name, ''), ?) WHERE id = 1", "Eva");

return { days, attacks, worsenings };
}
