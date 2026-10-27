
import {
CURRENT_SCHEMA_VERSION,
normalizeAuraState,
type AuraState,
type Warning,
} from "@aura/schema";
import { getDb } from "./index";

export interface AuraVersionRow {
id: string;
name: string;
created_at: string;
schema_version: number;
state_json: string;
background_type: string;
source_text: string | null;
ai_draft_json: string | null;
ai_model: string | null;
ai_warnings_json: string | null;
thumbnail_path: string | null;
source_attack_id:string | null;
}

export interface AuraVersion {
id: string;
name: string;
createdAt: string;
state: AuraState;
thumbnailPath: string | null;
sourceAttackId:string | null;
provenance: {
sourceText: string;
aiDraft: unknown;
model: string | null;
warnings: Warning[];
} | null;
loadWarnings: Warning[];
}

export interface SaveAuraInput {
sourceAttackId?:string | null;
name: string;
state: AuraState;
thumbnailPath?: string | null;
provenance?: {
sourceText: string;
aiDraft: unknown;
model: string | null;
warnings: Warning[];
} | null;
}

function newId(): string {
const t=Date.now().toString(36);
const r=Math.floor(Math.random() * 0xffffff)
.toString(36)
.padStart(5, "0");
return `aura_${t}_${r}`;
}

export async function saveAuraVersion(input: SaveAuraInput): Promise<AuraVersion> {
const db=await getDb();
const { state }=normalizeAuraState(input.state);

const id=newId();
const createdAt=new Date().toISOString();
const name=input.name.trim() || "Untitled";

await db.runAsync(
`INSERT INTO aura_versions
       (id, name, created_at, schema_version, state_json, background_type,
        source_text, ai_draft_json, ai_model, ai_warnings_json, thumbnail_path, source_attack_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
id,
name,
createdAt,
CURRENT_SCHEMA_VERSION,
JSON.stringify(state),
state.background.background_type,
input.provenance?.sourceText ?? null,
input.provenance ? JSON.stringify(input.provenance.aiDraft) : null,
input.provenance?.model ?? null,
input.provenance ? JSON.stringify(input.provenance.warnings) : null,
input.thumbnailPath ?? null,
input.sourceAttackId ?? null,
);

return {
id,
name,
createdAt,
state,
thumbnailPath: input.thumbnailPath ?? null,
sourceAttackId:input.sourceAttackId ?? null,
provenance: input.provenance ?? null,
loadWarnings: [],
};
}

function hydrate(row: AuraVersionRow): AuraVersion {
let parsed: unknown;
try {
parsed=JSON.parse(row.state_json);
}catch {
parsed=null;
}
const { state, warnings }=normalizeAuraState(parsed);

let provenance: AuraVersion["provenance"]=null;
if(row.source_text !== null){
let aiDraft: unknown=null;
let aiWarnings: Warning[]=[];
try {
if(row.ai_draft_json) aiDraft = JSON.parse(row.ai_draft_json);
if(row.ai_warnings_json) aiWarnings = JSON.parse(row.ai_warnings_json) as Warning[];
}catch {}
provenance={
sourceText: row.source_text,
aiDraft,
model: row.ai_model,
warnings: aiWarnings,
};
}

return {
id: row.id,
name: row.name,
createdAt: row.created_at,
state,
thumbnailPath: row.thumbnail_path,
sourceAttackId:row.source_attack_id ?? null,
provenance,
loadWarnings: warnings,
};
}

export async function listAuraVersions(limit = 200): Promise<AuraVersion[]> {
const db=await getDb();
const rows=await db.getAllAsync<AuraVersionRow>(
`SELECT * FROM aura_versions ORDER BY created_at DESC LIMIT ?`,
limit,
);
return rows.map(hydrate);
}

export async function getAuraVersion(id: string): Promise<AuraVersion | null> {
const db=await getDb();
const row=await db.getFirstAsync<AuraVersionRow>(
`SELECT * FROM aura_versions WHERE id = ?`,
id,
);
return row ? hydrate(row) : null;
}

export async function deleteAuraVersion(id: string): Promise<string | null> {
const db=await getDb();
const row=await db.getFirstAsync<{ thumbnail_path: string | null }>(
`SELECT thumbnail_path FROM aura_versions WHERE id = ?`,
id,
);
await db.runAsync(`DELETE FROM aura_versions WHERE id = ?`, id);
return row?.thumbnail_path ?? null;
}

export async function latestAuraVersion(): Promise<AuraVersion | null> {
const db=await getDb();
const row=await db.getFirstAsync<AuraVersionRow>(
`SELECT * FROM aura_versions ORDER BY created_at DESC LIMIT 1`,
);
return row ? hydrate(row) : null;
}
