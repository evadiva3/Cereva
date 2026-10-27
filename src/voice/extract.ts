
export type Severity="mild" | "moderate" | "severe";

export interface RedFlag {
id: string;
heard: string;
why: string;
}

export interface Extracted {
severity: Severity | null;
painMentioned: boolean;
continuous: boolean;
aura: "yes" | "no" | null;
meds: boolean;
symptoms: string[];
redFlags: RedFlag[];
heard: { phrase: string; meaning: string }[];
}

const NEGATORS=["doesnt", "doesn't", "arent", "aren't", "werent", "weren't", "cannot", "no", "not", "non", "never", "without", "didnt", "didn't", "dont", "don't", "havent", "haven't", "hasnt", "hasn't", "wasnt", "wasn't", "isnt", "isn't", "cant", "can't", "couldnt", "couldn't", "wont", "won't", "nothing", "none"];

const RED_FLAGS: { id: string; why: string; phrases: string[] }[]=[
{
id: "speech",
why: "Trouble speaking can be a sign of a stroke, not a migraine.",
phrases: ["slurred", "slurring", "slur my words", "trouble speaking", "cant speak", "can't speak", "cannot speak", "words wont come", "words won't come", "mumbling", "mumbled", "cant get my words", "can't get my words", "speech is off", "talking funny"],
},
{
id: "weakness",
why: "Weakness on one side can be a sign of a stroke.",
phrases: ["weakness", "weak on one side", "one side is weak", "arm is weak", "leg is weak", "face is drooping", "face drooping", "droop", "cant lift", "can't lift", "cant move my arm", "can't move my arm"],
},
{
id: "numbness",
why: "New numbness can be a sign of a stroke.",
phrases: ["numb", "numbness", "pins and needles on one side", "cant feel my", "can't feel my"],
},
{
id: "vision_loss",
why: "Losing vision is different from an aura and needs urgent care.",
phrases: ["lost my vision", "lost vision", "cant see", "can't see", "cannot see", "vision is gone", "went blind", "blind in one eye", "curtain over my eye"],
},
{
id: "thunderclap",
why: "A sudden worst ever headache needs urgent assessment.",
phrases: ["worst headache of my life", "worst headache ever", "worst pain of my life", "thunderclap", "came on like a thunderclap", "hit me instantly", "worst ive ever had", "worst i've ever had"],
},
{
id: "confusion",
why: "Confusion alongside a headache needs urgent assessment.",
phrases: ["confused", "confusion", "cant think straight", "can't think straight", "dont know where i am", "don't know where i am", "disoriented"],
},
{
id: "collapse",
why: "Fainting or a seizure needs urgent assessment.",
phrases: ["passed out", "fainted", "blacked out", "seizure", "convulsion", "fit"],
},
{
id: "neck_fever",
why: "A stiff neck with fever needs urgent assessment.",
phrases: ["stiff neck", "neck is stiff", "cant touch my chin", "can't touch my chin"],
},
];

const SEVERITY: { level: Severity; phrases: string[] }[]=[
{
level: "severe",
phrases: ["severe", "excruciating", "unbearable", "agony", "agonising", "agonizing", "blinding", "worst", "ten out of ten", "10 out of 10", "nine out of ten", "9 out of 10", "cant function", "can't function", "cant move", "can't move", "cant do anything", "can't do anything", "in bed all day", "extremely painful", "incredibly painful", "intensely painful", "hurts so much", "hurts really badly", "really intense pain", "very intense pain"],
},
{
level: "moderate",
phrases: ["moderate", "really painful", "very painful", "so painful", "quite painful", "pretty painful", "really hurts", "hurts really bad", "hurts pretty bad", "hurts quite a bit", "a lot of pain", "pretty bad", "quite bad", "really bad", "bad", "rough", "rough one", "hurts a lot", "pounding", "throbbing", "struggling", "hard to concentrate", "seven out of ten", "7 out of 10", "six out of ten", "6 out of 10", "five out of ten", "5 out of 10"],
},
{
level: "mild",
phrases: ["mild", "slight", "slightly painful", "a little painful", "a bit painful", "hurts a little", "hurts a bit", "dull", "manageable", "not too bad", "low level", "background", "niggle", "niggling", "twinge", "three out of ten", "3 out of 10", "two out of ten", "2 out of 10", "one out of ten", "1 out of 10"],
},
];

const CONTINUOUS=["constant", "constantly", "continuous", "continuously", "all the time", "never stops", "never stopped", "hasnt stopped", "hasn't stopped", "doesnt stop", "doesn't stop", "nonstop", "non stop", "24 7", "twenty four seven", "every day", "everyday", "chronic", "always there", "still going", "ongoing", "for weeks", "for months", "for years"];

const AURA=["aura", "zigzag", "zig zag", "flashing", "flashes", "shimmer", "shimmering", "blind spot", "blindspot", "scotoma", "spots in my vision", "sparkles", "sparkling", "wavy lines", "kaleidoscope", "jagged", "fortification", "seeing lights", "visual disturbance"];

const MEDS=["took", "taken", "triptan", "sumatriptan", "rizatriptan", "zolmitriptan", "naratriptan", "ibuprofen", "paracetamol", "acetaminophen", "tylenol", "advil", "nurofen", "aspirin", "naproxen", "excedrin", "medication", "meds", "painkiller", "pain killer", "tablet", "pill", "my usual"];

const SYMPTOMS: { label: string; phrases: string[] }[]=[
{ label: "nausea", phrases: ["nausea", "nauseous", "sick to my stomach", "queasy", "vomiting", "throwing up", "threw up"] },
{ label: "light sensitivity", phrases: ["light hurts", "lights hurt", "photophobia", "sensitive to light", "cant stand the light", "can't stand the light", "too bright", "squinting"] },
{ label: "sound sensitivity", phrases: ["sound hurts", "noise hurts", "phonophobia", "sensitive to sound", "sensitive to noise", "everything is loud"] },
{ label: "smell sensitivity", phrases: ["smells are strong", "sensitive to smell", "osmophobia"] },
{ label: "neck pain", phrases: ["neck hurts", "neck pain", "neck ache", "tight neck", "shoulders are tight"] },
{ label: "dizziness", phrases: ["dizzy", "dizziness", "vertigo", "room is spinning", "lightheaded", "light headed"] },
{ label: "one sided", phrases: ["one side", "left side", "right side", "behind my left eye", "behind my right eye", "one eye"] },
];

function normalize(text: string){
return ` ${text
.toLowerCase()
.replace(/[’‘]/g, "'")
.replace(/\brly\b/g, "really")
.replace(/\b(\d+)\s*\/\s*10\b/g, "$1 out of 10")
.replace(/\b(?:but|however|although)\b/g, " | ")
.replace(/[,;.!?]+/g, " | ")
.replace(/[^a-z0-9'| ]+/g, " ")
.replace(/\s+/g, " ")
.trim()} `;
}

function negated(haystack: string, at: number){
const before=haystack.slice(0, at).trim().split(" ");
const window: string[]=[];
for(let i = before.length - 1; i >= 0 && window.length < 5; i--){
const word=before[i]!;
if(word === "|") break;
window.push(word);
}
return window.some((w) => NEGATORS.includes(w));
}

function escape(s: string){
return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function find(haystack: string, phrases: string[]): string | null {
for(const phrase of phrases){
const cleaned=phrase.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
if(!cleaned) continue;
const re=new RegExp(`(?<=^|[ |])${escape(cleaned)}(s|es|ed|ing)?(?=[ |]|$)`, "g");
for(const m of haystack.matchAll(re)){
if(!negated(haystack, m.index)) return m[0];
}
}
return null;
}

const PAIN=["pain", "painful", "hurts", "hurt", "aching", "ache", "headache", "head ache", "head is killing me"];
const RATINGS=["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

function painRating(text: string): { level: Severity | null; phrase: string } | null {
const number="(?:10|[0-9]|" + RATINGS.join("|") + ")";
const pattern=new RegExp(`\\b(${number}) (?:out of|over) (?:10|ten)\\b`, "g");
let result: { level: Severity | null; phrase: string } | null=null;
for(const match of text.matchAll(pattern)){
if(negated(text,match.index)) continue;
const value=/^\d+$/.test(match[1]!) ? Number(match[1]) : RATINGS.indexOf(match[1]!);
result={level:value === 0 ? null : value <= 3 ? "mild" : value <= 7 ? "moderate" : "severe",phrase:match[0]};
}
return result;
}

export function extractReport(transcript: string): Extracted {
const text=normalize(transcript);
const heard: { phrase: string; meaning: string }[]=[];

const redFlags: RedFlag[]=[];
for(const flag of RED_FLAGS){
const hit=find(text, flag.phrases);
if(hit) redFlags.push({ id: flag.id, heard: hit, why: flag.why });
}

const rating=painRating(text);
let severity: Severity | null=rating?.level ?? null;
if(rating){
heard.push({phrase:rating.phrase,meaning:severity ? `${severity} pain` : "zero pain reported"});
}
for(const band of rating ? [] : SEVERITY){
const hit=find(text, band.phrases);
if(hit){
severity=band.level;
heard.push({ phrase: hit, meaning: `${band.level} pain` });
break;
}
}

const painHit=find(text, PAIN);
const painMentioned=severity !== null || (rating === null && painHit !== null);
if(painMentioned && !severity && painHit) heard.push({phrase:painHit,meaning:"pain mentioned; level unclear"});

const continuousHit=find(text, CONTINUOUS);
if(continuousHit) heard.push({ phrase: continuousHit, meaning: "it has not stopped" });

const auraHit=find(text, AURA);
if(auraHit) heard.push({ phrase: auraHit, meaning: "aura" });

const medsHit=find(text, MEDS);
if(medsHit) heard.push({ phrase: medsHit, meaning: "took something" });

const symptoms: string[]=[];
for(const s of SYMPTOMS){
const hit=find(text, s.phrases);
if(hit && !symptoms.includes(s.label)){
symptoms.push(s.label);
heard.push({ phrase: hit, meaning: s.label });
}
}

for(const flag of redFlags) heard.push({ phrase: flag.heard, meaning: "needs urgent care" });

return {
severity,
painMentioned,
continuous: continuousHit !== null,
aura: auraHit ? "yes" : null,
meds: medsHit !== null,
symptoms,
redFlags,
heard,
};
}
