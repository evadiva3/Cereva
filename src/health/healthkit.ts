
import {
isHealthDataAvailableAsync,
queryCategorySamples,
queryStatisticsForQuantity,
requestAuthorization,
} from "@kingstinct/react-native-healthkit";

import { localDayRange } from "@/dates";
import type { HealthValues } from "@/db/passiveDaily";

const READ_TYPES=[
"HKQuantityTypeIdentifierStepCount",
"HKCategoryTypeIdentifierSleepAnalysis",
"HKCategoryTypeIdentifierMenstrualFlow",
] as const;

export interface HealthAvailability {
available: boolean;
asked: boolean;
}

export async function isHealthAvailable(): Promise<boolean> {
try {
return await isHealthDataAvailableAsync();
}catch {
return false;
}
}

export async function requestHealthAccess(): Promise<boolean> {
if(!(await isHealthAvailable())) return false;
try {
return await requestAuthorization({ toRead: [...READ_TYPES] });
}catch {
return false;
}
}

async function readSleepMinutes(date: string): Promise<number | null> {
const { start, end }=localDayRange(date);
try {
const samples=await queryCategorySamples("HKCategoryTypeIdentifierSleepAnalysis", {
filter: { date: { startDate: start, endDate: end } },
limit: 0,
});
if(!samples || samples.length === 0) return null;

let totalMs=0;
for(const sample of samples){
const label=String((sample as { value?: unknown }).value ?? "");
if(!label.toLowerCase().includes("asleep")) continue;
const from=new Date(sample.startDate).getTime();
const to=new Date(sample.endDate).getTime();
if(Number.isFinite(from) && Number.isFinite(to) && to > from) totalMs += to - from;
}
if(totalMs === 0) return null;
return Math.round(totalMs / 60_000);
}catch {
return null;
}
}

async function readSteps(date: string): Promise<number | null> {
const { start, end }=localDayRange(date);
try {
const stats=await queryStatisticsForQuantity(
"HKQuantityTypeIdentifierStepCount",
["cumulativeSum"],
{ filter: { date: { startDate: start, endDate: end } }, unit: "count" },
);
const sum=(stats as { sumQuantity?: { quantity?: number } }).sumQuantity?.quantity;
return typeof sum === "number" && Number.isFinite(sum) ? Math.round(sum) : null;
}catch {
return null;
}
}

async function readMenstrualFlow(date: string): Promise<string | null> {
const { start, end }=localDayRange(date);
try {
const samples=await queryCategorySamples("HKCategoryTypeIdentifierMenstrualFlow", {
filter: { date: { startDate: start, endDate: end } },
limit: 1,
});
if(!samples || samples.length === 0) return null;
const value=(samples[0] as { value?: unknown }).value;
return value === undefined || value === null ? null : String(value);
}catch {
return null;
}
}

export async function readHealthDay(date: string): Promise<HealthValues> {
if(!(await isHealthAvailable())){
return { sleepMinutes: null, steps: null, menstrualFlow: null, source: "none" };
}

const [sleepMinutes, steps, menstrualFlow]=await Promise.all([
readSleepMinutes(date),
readSteps(date),
readMenstrualFlow(date),
]);

return {
sleepMinutes,
steps,
menstrualFlow,
source: "healthkit",
};
}

export function describeHealthStatus(values: HealthValues | null): string {
if(!values || values.source === "none"){
return "Apple Health is not available on this device.";
}
const found: string[]=[];
if(values.sleepMinutes !== null) found.push("sleep");
if(values.steps !== null) found.push("steps");
if(values.menstrualFlow !== null) found.push("cycle");
if(found.length === 0){
return (
"No Health data came back for this day. That can mean there is none " +
"recorded, or that this app was not given access. Apple does not tell " +
"apps which."
);
}
return `Reading ${found.join(", ")} from Apple Health.`;
}
