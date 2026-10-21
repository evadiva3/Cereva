
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";

import { runEngine } from "../../packages/engine/src/engine";
import { explainAll } from "../../packages/engine/src/explain";
import { buildEngineInput } from "@/db/engineAdapter";
import { getDb } from "@/db";
import { latestAuraVersion } from "@/db/auraVersions";
import { today } from "@/dates";

interface MonthRow {
month: string;
attack_days: number;
med_days: number;
}

function escapeHtml(s: string): string {
return s
.replace(/&/g, "&amp;")
.replace(/</g, "&lt;")
.replace(/>/g, "&gt;")
.replace(/"/g, "&quot;");
}

async function monthlyCounts(): Promise<MonthRow[]> {
const db=await getDb();
return db.getAllAsync<MonthRow>(`
    WITH days AS (
      SELECT local_date,
             MAX(attack) AS attack,
             MAX(med) AS med
        FROM (
          SELECT local_date, attack_day AS attack, acute_med AS med FROM day_logs
          UNION ALL
          SELECT local_date, 1 AS attack, meds AS med FROM attacks
        )
       GROUP BY local_date
    )
    SELECT substr(local_date, 1, 7) AS month,
           SUM(attack) AS attack_days,
           SUM(med) AS med_days
      FROM days
     GROUP BY month
     ORDER BY month DESC
     LIMIT 12
  `);
}

async function loosenSummary(): Promise<{ sessions: number; completed: number; weeks: number }> {
const db=await getDb();
const row=await db.getFirstAsync<{ sessions: number; completed: number; weeks: number }>(`
    SELECT COUNT(*) AS sessions,
           SUM(completed) AS completed,
           COUNT(DISTINCT strftime('%Y-%W', local_date)) AS weeks
      FROM loosen_sessions
  `);
return {
sessions: row?.sessions ?? 0,
completed: row?.completed ?? 0,
weeks: row?.weeks ?? 0,
};
}

function monthLabel(month: string): string {
const [y, m]=month.split("-");
const date=new Date(Number(y), Number(m) - 1, 1);
return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export async function buildDoctorReportHtml(): Promise<string> {
const [months, loosen, aura, engineDays]=await Promise.all([
monthlyCounts(),
loosenSummary(),
latestAuraVersion(),
buildEngineInput(),
]);

const output=runEngine(engineDays);
const explained=explainAll(output);

let auraImage="";
if(aura?.thumbnailPath){
try {
const file=new File(aura.thumbnailPath);
if(file.exists){
auraImage=`data:image/png;base64,${file.base64Sync()}`;
}
}catch {}
}

const monthRows=months
.map(
(m) =>
`<tr><td>${escapeHtml(monthLabel(m.month))}</td>` +
`<td class="n">${m.attack_days}</td>` +
`<td class="n">${m.med_days}</td></tr>`,
)
.join("");

const findingItems=explained.findings.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
const noClearItems=explained.noClearLink.map((f) => `<li>${escapeHtml(f)}</li>`).join("");
const notEnoughItems=explained.notEnough.map((f) => `<li>${escapeHtml(f)}</li>`).join("");

return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @page { margin: 14mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 10.5pt;
         color: #14141a; line-height: 1.45; }
  h1 { font-size: 15pt; margin: 0 0 2mm; }
  h2 { font-size: 11pt; margin: 5mm 0 1.5mm; border-bottom: 0.5pt solid #bbb;
       padding-bottom: 1mm; }
  .meta { color: #555; font-size: 9pt; margin-bottom: 3mm; }
  table { border-collapse: collapse; width: 100%; font-size: 9.5pt; }
  th, td { text-align: left; padding: 1.2mm 2mm; border-bottom: 0.25pt solid #ddd; }
  th { color: #555; font-weight: 600; }
  td.n, th.n { text-align: right; }
  .cols { display: flex; gap: 6mm; }
  .col { flex: 1; }
  ul { margin: 1mm 0; padding-left: 5mm; }
  li { margin-bottom: 1.2mm; }
  .muted { color: #666; font-size: 9pt; }
  .aura { width: 38mm; border: 0.25pt solid #ccc; }
  .footer { margin-top: 6mm; padding-top: 2mm; border-top: 0.5pt solid #bbb;
            color: #555; font-size: 8.5pt; }
</style></head><body>

<h1>Migraine diary summary</h1>
<div class="meta">
  Generated ${escapeHtml(new Date().toLocaleDateString())} from a self-recorded diary.
  ${output.loggedDays} logged days, ${output.onsets} attack starts analysed.
</div>

<div class="cols">
  <div class="col">
    <h2>Attack and medication days per month</h2>
    ${
monthRows
? `<table><tr><th>Month</th><th class="n">Attack days</th><th class="n">Medication days</th></tr>${monthRows}</table>`
: '<p class="muted">No months recorded yet.</p>'
}
  </div>
  <div class="col" style="flex: 0 0 42mm;">
    <h2>Current aura</h2>
    ${
auraImage
? `<img class="aura" src="${auraImage}" alt="The patient's own representation of their aura" />
<div class="muted">Saved ${escapeHtml(new Date(aura!.createdAt).toLocaleDateString())}</div>`
: '<p class="muted">No aura saved.</p>'
}
    <div class="muted" style="margin-top:2mm;">
      Drawn by the patient as a representation of what they see. Not a
      measurement.
    </div>
  </div>
</div>

<h2>Possible associations in this diary</h2>
<p class="muted">${escapeHtml(explained.headline)}</p>
${findingItems ? `<ul>${findingItems}</ul>` : ""}
${
noClearItems
? `<p class="muted" style="margin-top:2mm;">Examined, nothing clear:</p><ul class="muted">${noClearItems}</ul>`
: ""
}
${
notEnoughItems
? `<p class="muted" style="margin-top:2mm;">Not enough data to examine:</p><ul class="muted">${notEnoughItems}</ul>`
: ""
}

<h2>Relaxation practice</h2>
<p class="muted">
  ${loosen.sessions} sessions started, ${loosen.completed} completed, across
  ${loosen.weeks} weeks with any practice. Progressive muscle relaxation,
  self-directed.
</p>

<div class="footer">
  This summary was produced by an app from data the patient entered themselves.
  It is not a diagnostic report. The associations listed are statistical
  patterns within one person's diary, adjusted for multiple comparisons, and
  are not evidence of cause. Factors marked as having no clear link have not
  been excluded. Nothing here should be read as a recommendation about
  treatment.
</div>

</body></html>`;
}

export async function shareDoctorReport(): Promise<void> {
const html=await buildDoctorReportHtml();
const { uri }=await Print.printToFileAsync({ html });
if(!(await Sharing.isAvailableAsync())){
throw new Error("Sharing is not available on this device.");
}
await Sharing.shareAsync(uri, {
mimeType: "application/pdf",
dialogTitle: `Migraine diary summary, ${today()}`,
UTI: "com.adobe.pdf",
});
}
