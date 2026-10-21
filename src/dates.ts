
export function localDate(d: Date = new Date()): string {
const y=d.getFullYear();
const m=String(d.getMonth() + 1).padStart(2, "0");
const day=String(d.getDate()).padStart(2, "0");
return `${y}-${m}-${day}`;
}

export function today(): string {
return localDate();
}

export function yesterday(from: Date = new Date()): string {
const d=new Date(from.getFullYear(), from.getMonth(), from.getDate());
d.setDate(d.getDate() - 1);
return localDate(d);
}

export function addDays(date: string, days: number): string {
const d=parseLocalDate(date);
d.setDate(d.getDate() + days);
return localDate(d);
}

export function parseLocalDate(date: string): Date {
const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
if(!match) throw new Error(`not a local date string: ${date}`);
const [, y, m, d]=match;
return new Date(Number(y), Number(m) - 1, Number(d));
}

export function localDayRange(date: string): { start: Date; end: Date } {
const start=parseLocalDate(date);
const end=new Date(start);
end.setDate(end.getDate() + 1);
return { start, end };
}

export function daysBetween(a: string, b: string): number {
const msPerDay=86_400_000;
const toNoonUtc=(s: string) => {
const d=parseLocalDate(s);
return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12);
};
return Math.round((toNoonUtc(b) - toNoonUtc(a)) / msPerDay);
}

export function loggableDates(now: Date = new Date()): string[] {
return [localDate(now), yesterday(now)];
}

export function isLoggable(date: string, now: Date = new Date()): boolean {
return loggableDates(now).includes(date);
}

export function dateLabel(date: string, now: Date = new Date()): string {
if(date === localDate(now)) return "Today";
if(date === yesterday(now)) return "Yesterday";
return parseLocalDate(date).toLocaleDateString(undefined, {
weekday: "short",
month: "short",
day: "numeric",
});
}

export function dateRange(start: string, end: string): string[] {
const out: string[]=[];
const total=daysBetween(start, end);
if(total < 0) return out;
for(let i = 0; i <= total; i++) out.push(addDays(start, i));
return out;
}

export function startOfWeek(date: string, weekStartsOn: number): string {
const d=parseLocalDate(date);
const shift=(d.getDay() - weekStartsOn + 7) % 7;
d.setDate(d.getDate() - shift);
return localDate(d);
}

export function deviceWeekStart(): number {
try {
const locale=new Intl.Locale(
Intl.DateTimeFormat().resolvedOptions().locale,
) as Intl.Locale & {
getWeekInfo?: () => { firstDay: number };
weekInfo?: { firstDay: number };
};
const info=locale.getWeekInfo?.() ?? locale.weekInfo;
if(info && typeof info.firstDay === "number"){
return info.firstDay === 7 ? 0 : info.firstDay;
}
}catch {}
return 0;
}
