
import * as Location from "expo-location";

import { addDays, daysBetween, today } from "@/dates";
import {
datesMissingWeather,
recomputeChanges,
upsertWeather,
type WeatherValues,
} from "@/db/passiveDaily";

const ENDPOINT="https://api.open-meteo.com/v1/forecast";

const GRID_DEGREES=0.1;

const TIMEOUT_MS=15_000;

const MAX_BACKFILL_DAYS=60;

function coarsen(value: number): number {
return Math.round(value / GRID_DEGREES) * GRID_DEGREES;
}

export class LocationUnavailableError extends Error {
constructor(message: string){
super(message);
this.name="LocationUnavailableError";
}
}

export async function requestCoarseLocation(): Promise<{ lat: number; lon: number }> {
const { status }=await Location.requestForegroundPermissionsAsync();
if(status !== "granted"){
throw new LocationUnavailableError(
"Weather needs a rough idea of where you are. Without it, the other " +
"factors still work and weather is simply left out.",
);
}

const position=await Location.getLastKnownPositionAsync({})
.then((p) => p ?? Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }))
.catch(() => null);

if(!position){
throw new LocationUnavailableError("Could not work out your location just now.");
}

return {
lat: coarsen(position.coords.latitude),
lon: coarsen(position.coords.longitude),
};
}

interface OpenMeteoDaily {
time: string[];
pressure_msl_mean?: (number | null)[];
surface_pressure_mean?: (number | null)[];
temperature_2m_mean?: (number | null)[];
relative_humidity_2m_mean?: (number | null)[];
}

async function fetchDaily(
lat: number,
lon: number,
pastDays: number,
): Promise<Map<string, WeatherValues>> {
const params=new URLSearchParams({
latitude: lat.toFixed(2),
longitude: lon.toFixed(2),
daily: [
"pressure_msl_mean",
"surface_pressure_mean",
"temperature_2m_mean",
"relative_humidity_2m_mean",
].join(","),
past_days: String(Math.min(pastDays, MAX_BACKFILL_DAYS)),
forecast_days: "1",
timezone: "auto",
});

const controller=new AbortController();
const timer=setTimeout(() => controller.abort(), TIMEOUT_MS);
let response: Response;
try {
response=await fetch(`${ENDPOINT}?${params.toString()}`, { signal: controller.signal });
}finally {
clearTimeout(timer);
}

if(!response.ok){
throw new Error(`weather service returned ${response.status}`);
}

const body=(await response.json()) as { daily?: OpenMeteoDaily };
const daily=body.daily;
if(!daily || !Array.isArray(daily.time)){
throw new Error("weather service returned an unexpected shape");
}

const out=new Map<string, WeatherValues>();
daily.time.forEach((date, i) => {
const at=<T>(arr: (T | null)[] | undefined): T | null => arr?.[i] ?? null;
out.set(date, {
pressureMsl: at(daily.pressure_msl_mean),
pressureSurface: at(daily.surface_pressure_mean),
tempMean: at(daily.temperature_2m_mean),
humidity: at(daily.relative_humidity_2m_mean),
source: "open-meteo",
});
});
return out;
}

export interface SyncResult {
fetched: number;
skipped: number;
error: string | null;
}

export async function syncWeather(options?: { force?: boolean }): Promise<SyncResult> {
let coords: { lat: number; lon: number };
try {
coords=await requestCoarseLocation();
}catch(err){
return { fetched: 0, skipped: 0, error: (err as Error).message };
}

const end=today();
const start=addDays(end, -(MAX_BACKFILL_DAYS - 1));
const wanted: string[]=[];
for(let i = 0; i < MAX_BACKFILL_DAYS; i++) wanted.push(addDays(start, i));

const missing=options?.force ? wanted : await datesMissingWeather(wanted);
if(missing.length === 0){
return { fetched: 0, skipped: wanted.length, error: null };
}

const oldestGap=missing[0]!;
const pastDays=Math.max(1, daysBetween(oldestGap, end) + 1);

let daily: Map<string, WeatherValues>;
try {
daily=await fetchDaily(coords.lat, coords.lon, pastDays);
}catch(err){
const message =
(err as Error).name === "AbortError"
? "The weather service did not respond in time."
: (err as Error).message;
return { fetched: 0, skipped: 0, error: message };
}

let fetched=0;
for(const date of missing){
const values=daily.get(date);
if(!values) continue;
if(
values.pressureMsl === null &&
values.pressureSurface === null &&
values.tempMean === null &&
values.humidity === null
){
continue;
}
await upsertWeather(date, values);
fetched++;
}

await recomputeChanges();

return { fetched, skipped: wanted.length - missing.length, error: null };
}
