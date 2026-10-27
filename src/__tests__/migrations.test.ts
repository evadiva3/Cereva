import { MIGRATIONS, LATEST_VERSION } from "../db/migrations";

describe("migrations", () => {
it("numbers every migration uniquely and in order", () => {
const versions=MIGRATIONS.map((m) => m.version);
expect(new Set(versions).size).toBe(versions.length);
expect([...versions].sort((a, b) => a - b)).toEqual(versions);
});

it("starts at 1 and leaves no gaps", () => {
MIGRATIONS.forEach((m, i) => expect(m.version).toBe(i + 1));
});

it("reports the highest version as the latest", () => {
expect(LATEST_VERSION).toBe(Math.max(...MIGRATIONS.map((m) => m.version)));
});

it("has at least one statement per migration and names them", () => {
for(const m of MIGRATIONS){
expect(m.statements.length).toBeGreaterThan(0);
expect(m.name.trim().length).toBeGreaterThan(0);
for(const s of m.statements) expect(s.trim().length).toBeGreaterThan(0);
}
});

it("never edits an already shipped migration in place", () => {
const first=MIGRATIONS.find((m) => m.version === 1);
expect(first?.name).toBe("initial schema");
expect(first?.statements.some((s) => s.includes("CREATE TABLE settings"))).toBe(true);
});

it("adds readings so one attack can carry several severities", () => {
const v2=MIGRATIONS.find((m) => m.version === 2);
expect(v2).toBeDefined();
const sql=v2!.statements.join("\n");
expect(sql).toContain("CREATE TABLE attack_readings");
expect(sql).toContain("attack_id");
expect(sql).toContain("severity");
expect(sql).toContain("ON DELETE CASCADE");
});

it("lets an attack be marked continuous rather than forcing an end", () => {
const sql=MIGRATIONS.flatMap((m) => m.statements).join("\n");
expect(sql).toContain("ALTER TABLE attacks ADD COLUMN continuous");
});
});
