
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=fileURLToPath(new URL("..", import.meta.url));

const BANNED=[
[String.fromCodePoint(0x2014), "em dash"],
[String.fromCodePoint(0x2013), "en dash"],
[String.fromCodePoint(0x2212), "minus sign"],
[String.fromCodePoint(0x2015), "horizontal bar"],
];

const SKIP_DIRS=new Set([
"node_modules",
"dist",
".expo",
"build",
"ios",
"android",
"coverage",
".venv",
"__pycache__",
]);

const SKIP_EXT=new Set([
".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf",
".ttf", ".otf", ".woff", ".woff2",
".zip", ".mp3", ".mp4", ".wav", ".m4a",
".lock",
]);

const SKIP_FILES=new Set(["package-lock.json"]);

const offenders=[];

function walk(dir){
for(const entry of readdirSync(dir)){
if(entry.startsWith(".") && entry !== ".github") continue;
const full=join(dir, entry);
const st=statSync(full);
if(st.isDirectory()){
if(SKIP_DIRS.has(entry)) continue;
walk(full);
continue;
}
if(SKIP_FILES.has(entry)) continue;
const dot=entry.lastIndexOf(".");
if(dot >= 0 && SKIP_EXT.has(entry.slice(dot).toLowerCase())) continue;

let text;
try {
text=readFileSync(full, "utf8");
}catch {
continue;
}
const lines=text.split("\n");
for(let i = 0; i < lines.length; i++){
for(const [ch, name] of BANNED){
if(lines[i].includes(ch)){
offenders.push({
file: relative(ROOT, full),
line: i + 1,
name,
text: lines[i].trim().slice(0, 100),
});
}
}
}
}
}

walk(ROOT);

if(offenders.length === 0){
console.log("OK: no em dashes or en dashes in the repository");
process.exit(0);
}

console.error(`FAIL: ${offenders.length} banned dash occurrences`);
for(const o of offenders.slice(0, 40)){
console.error(`  ${o.file}:${o.line} (${o.name}): ${o.text}`);
}
if(offenders.length > 40) console.error(`  ... and ${offenders.length - 40} more`);
process.exit(1);
