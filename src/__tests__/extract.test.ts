import { extractReport } from "../voice/extract";

describe("listening to someone describe an attack", () => {
it("hears nothing in an empty transcript", () => {
const r=extractReport("");
expect(r.severity).toBeNull();
expect(r.redFlags).toEqual([]);
expect(r.continuous).toBe(false);
});

it("picks the severity out of ordinary speech", () => {
expect(extractReport("it is absolutely unbearable today").severity).toBe("severe");
expect(extractReport("pretty bad, throbbing behind my eye").severity).toBe("moderate");
expect(extractReport("just a dull one, manageable").severity).toBe("mild");
});

it("takes a number out of ten", () => {
expect(extractReport("about a 9 out of 10").severity).toBe("severe");
expect(extractReport("maybe 3 out of 10").severity).toBe("mild");
});

it("notices when it never stops", () => {
expect(extractReport("it is constant, it never stopped").continuous).toBe(true);
expect(extractReport("this has been going for months").continuous).toBe(true);
expect(extractReport("started this morning").continuous).toBe(false);
});

it("hears an aura described without the word aura", () => {
expect(extractReport("zigzag shimmering lines on the left").aura).toBe("yes");
expect(extractReport("there is a blind spot in the middle").aura).toBe("yes");
});

it("hears medication by brand or by habit", () => {
expect(extractReport("I took my sumatriptan an hour ago").meds).toBe(true);
expect(extractReport("had some ibuprofen").meds).toBe(true);
expect(extractReport("just lying down").meds).toBe(false);
});

it("collects the symptoms that came up", () => {
const r=extractReport("nauseous, the light hurts and my neck aches");
expect(r.symptoms).toEqual(expect.arrayContaining(["nausea", "light sensitivity", "neck pain"]));
});

describe("negation", () => {
it("does not record an aura that was ruled out", () => {
expect(extractReport("no aura this time, just pain").aura).toBeNull();
});

it("does not record medication that was not taken", () => {
expect(extractReport("I haven't taken anything yet").meds).toBe(false);
});

it("does not call it severe when they said it is not severe", () => {
expect(extractReport("it is not severe, just a niggle").severity).toBe("mild");
});

it("does not raise a red flag that was explicitly denied", () => {
expect(extractReport("no slurred speech, no weakness").redFlags).toEqual([]);
});
});

describe("red flags, which matter more than the rest of this", () => {
it("catches slurred speech", () => {
const r=extractReport("my words are coming out slurred");
expect(r.redFlags.map((f) => f.id)).toContain("speech");
expect(r.redFlags[0]!.why).toMatch(/stroke/i);
});

it("catches mumbling, which someone may not call slurring", () => {
expect(extractReport("I keep mumbling").redFlags.map((f) => f.id)).toContain("speech");
});

it("catches one sided weakness", () => {
expect(extractReport("my arm is weak").redFlags.map((f) => f.id)).toContain("weakness");
});

it("catches numbness", () => {
expect(extractReport("my face feels numb").redFlags.map((f) => f.id)).toContain("numbness");
});

it("catches losing vision, which is not the same as an aura", () => {
const r=extractReport("I lost my vision in one eye");
expect(r.redFlags.map((f) => f.id)).toContain("vision_loss");
});

it("catches the worst headache of my life", () => {
expect(
extractReport("this is the worst headache of my life").redFlags.map((f) => f.id),
).toContain("thunderclap");
});

it("catches confusion, fainting and a stiff neck", () => {
expect(extractReport("I feel confused").redFlags.map((f) => f.id)).toContain("confusion");
expect(extractReport("I passed out").redFlags.map((f) => f.id)).toContain("collapse");
expect(extractReport("my neck is stiff").redFlags.map((f) => f.id)).toContain("neck_flag".replace("flag", "fever"));
});

it("raises the flag even when the rest of the sentence sounds routine", () => {
const r=extractReport("took my triptan, mild pain, but my speech is off");
expect(r.severity).toBe("mild");
expect(r.meds).toBe(true);
expect(r.redFlags.map((f) => f.id)).toContain("speech");
});
});

it("reports what it thought it heard, so nothing is silent", () => {
const r=extractReport("severe, constant, I took a triptan, feeling nauseous");
const meanings=r.heard.map((h) => h.meaning);
expect(meanings).toContain("severe pain");
expect(meanings).toContain("it has not stopped");
expect(meanings).toContain("took something");
expect(meanings).toContain("nausea");
});

it("is not fooled by a word inside another word", () => {
expect(extractReport("the restaurant was loud").severity).toBeNull();
});
});

describe("conversational pain descriptions", () => {
it.each([
["it's really painful", "moderate"],
["its rly painful", "moderate"],
["it really hurts", "moderate"],
["I'm in a lot of pain", "moderate"],
["it's extremely painful", "severe"],
["my head hurts so much", "severe"],
["it hurts a little", "mild"],
["it's a bit painful", "mild"],
])("understands %s", (said, level) => {
const report=extractReport(said);
expect(report.severity).toBe(level);
expect(report.painMentioned).toBe(true);
});

it.each(["my head hurts", "it's painful", "I have a headache", "my head is aching"])("retains pain without inventing a level: %s", said => {
const report=extractReport(said);
expect(report.painMentioned).toBe(true);
expect(report.severity).toBeNull();
expect(report.heard).toContainEqual(expect.objectContaining({meaning:"pain mentioned; level unclear"}));
});

it.each(["it's not really painful", "I don’t have any pain", "my head doesn't hurt"])("respects a denial: %s", said => {
expect(extractReport(said).painMentioned).toBe(false);
expect(extractReport(said).severity).toBeNull();
});

it("recognizes later positive mentions after a denial", () => {
expect(extractReport("it wasn't painful before but it's really painful now").severity).toBe("moderate");
expect(extractReport("no aura earlier, now I have aura").aura).toBe("yes");
expect(extractReport("not severe earlier but severe now").severity).toBe("severe");
});

it("handles typographic apostrophes in denials", () => {
expect(extractReport("I haven’t taken any medication").meds).toBe(false);
expect(extractReport("I don’t have weakness").redFlags).toEqual([]);
});

it("does not infer pain severity from other symptoms alone", () => {
expect(extractReport("I'm a bit dizzy and throwing up").severity).toBeNull();
});

it.each([
["four out of ten", "moderate"],
["eight out of ten", "severe"],
["8/10", "severe"],
["4 out of 10", "moderate"],
["two over ten", "mild"],
])("recognizes the rating %s", (said, level) => {
expect(extractReport(said).severity).toBe(level);
});

it("uses an explicit rating ahead of vague adjectives", () => {
expect(extractReport("pretty bad, eight out of ten").severity).toBe("severe");
expect(extractReport("not nine out of ten, five out of ten").severity).toBe("moderate");
expect(extractReport("zero out of ten now").severity).toBeNull();
});
});
