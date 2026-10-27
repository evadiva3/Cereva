
import { getDb } from "./index";

export type SourceFlag = "none" | "healthkit" | "open-meteo" | "declined" | "failed";

export interface PassiveDay {
localDate: string;
sleepMinutes: number | null;
steps: number | null;
cyclePhase: string | null;
menstrualFlow: string | null;
pressureMsl: number | null;
pressureSurface: number | null;
pressureChange: number | null;
tempMean: number | null;
tempChange: number | null;
humidity: number | null;
healthSource: SourceFlag;
weatherSource: SourceFlag;
fetchedAt: string | null;
}


export interface HealthValues {
sleepMinutes: number | null;
steps: number | null;
menstrualFlow: string | null;
source: SourceFlag;
}

export interface WeatherValues {
pressureMsl: number | null;
pressureSurface: number | null;
tempMean: number | null;
humidity: number | null;
source: SourceFlag;
}

export async function upsertHealth(date: string, values: HealthValues): Promise<void> {
const db=await getDb();
await db.runAsync(
`INSERT INTO passive_daily
       (local_date, sleep_minutes, steps, menstrual_flow, health_source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (local_date) DO UPDATE SET
       sleep_minutes=excluded.sleep_minutes,
       steps=excluded.steps,
       menstrual_flow=excluded.menstrual_flow,
       health_source=excluded.health_source,
       fetched_at=excluded.fetched_at`,
date,
values.sleepMinutes,
values.steps,
values.menstrualFlow,
values.source,
new Date().toISOString(),
);
}

export async function upsertWeather(date: string, values: WeatherValues): Promise<void> {
const db=await getDb();
await db.runAsync(
`INSERT INTO passive_daily
       (local_date, pressure_msl, pressure_surface, temp_mean, humidity,
        weather_source, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (local_date) DO UPDATE SET
       pressure_msl=excluded.pressure_msl,
       pressure_surface=excluded.pressure_surface,
       temp_mean=excluded.temp_mean,
       humidity=excluded.humidity,
       weather_source=excluded.weather_source,
       fetched_at=excluded.fetched_at`,
date,
values.pressureMsl,
values.pressureSurface,
values.tempMean,
values.humidity,
values.source,
new Date().toISOString(),
);
}

export async function recomputeChanges(): Promise<void> {
const db=await getDb();
await db.execAsync(`
    WITH ordered AS (
      SELECT local_date,
             pressure_msl,
             temp_mean,
             LAG(pressure_msl) OVER (ORDER BY local_date) AS prev_pressure,
             LAG(temp_mean)    OVER (ORDER BY local_date) AS prev_temp,
             LAG(local_date)   OVER (ORDER BY local_date) AS prev_date
        FROM passive_daily
    )
    UPDATE passive_daily
       SET pressure_change = (
             SELECT CASE
                      WHEN o.prev_date IS NOT NULL
                       AND julianday(o.local_date) - julianday(o.prev_date) = 1
                      THEN o.pressure_msl - o.prev_pressure
                      ELSE NULL
                    END
               FROM ordered o WHERE o.local_date = passive_daily.local_date
           ),
           temp_change=(
             SELECT CASE
                      WHEN o.prev_date IS NOT NULL
                       AND julianday(o.local_date) - julianday(o.prev_date) = 1
                      THEN o.temp_mean - o.prev_temp
                      ELSE NULL
                    END
               FROM ordered o WHERE o.local_date = passive_daily.local_date
           )
  `);
}

export async function datesMissingWeather(dates: string[]): Promise<string[]> {
if(dates.length === 0) return [];
const db=await getDb();
const placeholders=dates.map(() => "?").join(",");
const rows=await db.getAllAsync<{ local_date: string }>(
`SELECT local_date FROM passive_daily
      WHERE local_date IN (${placeholders}) AND weather_source = 'open-meteo'`,
...dates,
);
const have=new Set(rows.map((r) => r.local_date));
return dates.filter((d) => !have.has(d));
}
