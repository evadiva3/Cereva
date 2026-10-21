
export interface DayRecord {
date: string;

logged: boolean;

attack: boolean;

alcohol: boolean | null;
caffeineChange: boolean | null;
skippedMeal: boolean | null;
stress: number | null;

sleepMinutes: number | null;
steps: number | null;
menstruating: boolean | null;

pressureChange: number | null;
tempChange: number | null;
humidity: number | null;

loosenSession: boolean;
}

export const FACTOR_IDS=[
"sleep_short",
"steps",
"pressure_change",
"temp_change",
"humidity",
"alcohol",
"caffeine_change",
"skipped_meal",
"stress",
"cycle",
"loosen_week",
] as const;

export type FactorId = (typeof FACTOR_IDS)[number];

export const FACTOR_LABELS: Record<FactorId, string>={
sleep_short: "Short sleep",
steps: "Steps",
pressure_change: "Air pressure change",
temp_change: "Temperature change",
humidity: "Humidity",
alcohol: "Alcohol",
caffeine_change: "Caffeine change",
skipped_meal: "Skipped meal",
stress: "Stress",
cycle: "Cycle",
loosen_week: "Loosen practice",
};

export type FactorLabel =
| "linked_more"
| "linked_fewer"
| "no_clear_link"
| "not_enough_data";

export const LABEL_TEXT: Record<FactorLabel, string>={
linked_more: "linked to more attacks",
linked_fewer: "linked to fewer attacks",
no_clear_link: "no clear link",
not_enough_data: "not enough data yet",
};

export type InsufficientReason =
| "too_few_days"
| "too_few_onsets"
| "too_few_exposed"
| "too_few_unexposed"
| "too_few_exposed_onsets"
| "no_variation"
| "not_collected"
| "fit_failed";

export interface FactorCounts {
riskDays: number;
onsets: number;
exposedDays: number | null;
unexposedDays: number | null;
exposedOnsets: number | null;
observedDays: number;
}

export interface LagEstimate {
lag: 0 | 1;
oddsRatio: number;
lower: number;
upper: number;
}

export interface FactorResult {
factor: FactorId;
label: FactorLabel;
reason: InsufficientReason | null;
counts: FactorCounts;
lags: LagEstimate[];
rawP: number | null;
adjustedP: number | null;
perStandardDeviation: boolean;
}

export interface EngineOutput {
engineVersion: string;
windowStart: string | null;
windowEnd: string | null;
loggedDays: number;
riskDays: number;
onsets: number;
attackDayFraction: number;
factorsAssessed: number;
results: FactorResult[];
overallReason: InsufficientReason | null;
}

export const ENGINE_VERSION="1.0.0";
