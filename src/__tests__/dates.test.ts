
import {
addDays,
dateLabel,
dateRange,
daysBetween,
isLoggable,
loggableDates,
localDate,
localDayRange,
parseLocalDate,
startOfWeek,
today,
yesterday,
} from "../dates";

describe("localDate", () => {
it("uses local calendar fields, not UTC", () => {
const d=new Date(2026, 2, 14, 17, 0, 0);
expect(localDate(d)).toBe("2026-03-14");
});

it("pads single-digit months and days", () => {
expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05");
});

it("handles the last instant of a local day", () => {
expect(localDate(new Date(2026, 2, 14, 23, 59, 59))).toBe("2026-03-14");
});

it("handles the first instant of a local day", () => {
expect(localDate(new Date(2026, 2, 14, 0, 0, 0))).toBe("2026-03-14");
});
});

describe("yesterday", () => {
it("is the previous calendar day", () => {
expect(yesterday(new Date(2026, 2, 14, 10))).toBe("2026-03-13");
});

it("crosses a month boundary", () => {
expect(yesterday(new Date(2026, 2, 1, 10))).toBe("2026-02-28");
});

it("crosses a year boundary", () => {
expect(yesterday(new Date(2026, 0, 1, 10))).toBe("2025-12-31");
});

it("handles a leap day", () => {
expect(yesterday(new Date(2028, 1, 29, 10))).toBe("2028-02-28");
});
});

describe("daylight saving", () => {

it("treats a spring-forward day as one day", () => {
expect(addDays("2026-03-08", 1)).toBe("2026-03-09");
expect(daysBetween("2026-03-08", "2026-03-09")).toBe(1);
});

it("treats a fall-back day as one day", () => {
expect(addDays("2026-11-01", 1)).toBe("2026-11-02");
expect(daysBetween("2026-11-01", "2026-11-02")).toBe(1);
});

it("counts a week across a transition as seven days", () => {
expect(daysBetween("2026-03-05", "2026-03-12")).toBe(7);
expect(daysBetween("2026-10-29", "2026-11-05")).toBe(7);
});

it("round-trips addDays and daysBetween across a transition", () => {
for(const start of ["2026-03-07", "2026-03-08", "2026-10-31", "2026-11-01"]){
for(const n of [1, 2, 7, 30, -1, -7]){
expect(daysBetween(start, addDays(start, n))).toBe(n);
}
}
});
});

describe("parseLocalDate", () => {
it("parses to local midnight, not UTC midnight", () => {
const d=parseLocalDate("2026-03-14");
expect(d.getFullYear()).toBe(2026);
expect(d.getMonth()).toBe(2);
expect(d.getDate()).toBe(14);
expect(d.getHours()).toBe(0);
});

it("round-trips through localDate", () => {
for(const s of ["2026-01-01", "2026-06-15", "2026-12-31", "2028-02-29"]){
expect(localDate(parseLocalDate(s))).toBe(s);
}
});

it("rejects anything that is not a local date string", () => {
for(const bad of ["", "2026-3-4", "14/03/2026", "2026-03-14T10:00:00Z", "nope"]){
expect(() => parseLocalDate(bad)).toThrow();
}
});
});

describe("localDayRange", () => {
it("spans exactly one calendar day", () => {
const { start, end }=localDayRange("2026-03-14");
expect(localDate(start)).toBe("2026-03-14");
expect(localDate(end)).toBe("2026-03-15");
expect(start.getHours()).toBe(0);
});

it("spans a 23 hour day correctly", () => {
const { start, end }=localDayRange("2026-03-08");
expect(localDate(end)).toBe("2026-03-09");
expect(end.getTime()).toBeGreaterThan(start.getTime());
});
});

describe("loggable dates", () => {
it("is today and yesterday only", () => {
const now=new Date(2026, 2, 14, 10);
expect(loggableDates(now)).toEqual(["2026-03-14", "2026-03-13"]);
});

it("refuses the day before yesterday", () => {
const now=new Date(2026, 2, 14, 10);
expect(isLoggable("2026-03-12", now)).toBe(false);
});

it("refuses the future", () => {
const now=new Date(2026, 2, 14, 10);
expect(isLoggable("2026-03-15", now)).toBe(false);
});

it("accepts today and yesterday", () => {
const now=new Date(2026, 2, 14, 10);
expect(isLoggable("2026-03-14", now)).toBe(true);
expect(isLoggable("2026-03-13", now)).toBe(true);
});
});

describe("dateLabel", () => {
it("names today and yesterday rather than printing a date", () => {
const now=new Date(2026, 2, 14, 10);
expect(dateLabel("2026-03-14", now)).toBe("Today");
expect(dateLabel("2026-03-13", now)).toBe("Yesterday");
expect(dateLabel("2026-03-01", now)).not.toBe("Today");
});
});

describe("dateRange", () => {
it("is inclusive at both ends", () => {
expect(dateRange("2026-03-01", "2026-03-04")).toEqual([
"2026-03-01",
"2026-03-02",
"2026-03-03",
"2026-03-04",
]);
});

it("returns a single day when start equals end", () => {
expect(dateRange("2026-03-01", "2026-03-01")).toEqual(["2026-03-01"]);
});

it("returns nothing when the range is backwards", () => {
expect(dateRange("2026-03-04", "2026-03-01")).toEqual([]);
});

it("produces 60 entries for a 60 day window, including across a transition", () => {
const range=dateRange("2026-02-15", addDays("2026-02-15", 59));
expect(range).toHaveLength(60);
expect(new Set(range).size).toBe(60);
});
});

describe("startOfWeek", () => {
it("respects a Sunday start", () => {
expect(startOfWeek("2026-03-14", 0)).toBe("2026-03-08");
});

it("respects a Monday start", () => {
expect(startOfWeek("2026-03-14", 1)).toBe("2026-03-09");
});

it("is idempotent", () => {
for(const start of [0, 1]){
const first=startOfWeek("2026-03-14", start);
expect(startOfWeek(first, start)).toBe(first);
}
});

it("holds across a spring-forward week", () => {
expect(startOfWeek("2026-03-09", 0)).toBe("2026-03-08");
});
});

describe("today", () => {
it("agrees with localDate of now", () => {
expect(today()).toBe(localDate(new Date()));
});
});
