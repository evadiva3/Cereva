
import { z } from "zod";

import {
CURRENT_SCHEMA_VERSION,
normalizeAuraState,
type AuraState,
type Warning,
} from "@aura/schema";

const PROXY_URL=process.env.EXPO_PUBLIC_CEREVA_PROXY_URL ?? "";

const CLIENT_TOKEN=process.env.EXPO_PUBLIC_CEREVA_CLIENT_TOKEN ?? "";

const TIMEOUT_MS=260_000;

export const MAX_DESCRIPTION_LENGTH=2000;

const warningSchema=z.object({
kind: z.string(),
path: z.string(),
message: z.string(),
});

const describeResponseSchema=z.object({
schema_version: z.number(),
draft: z.unknown(),
raw_draft: z.unknown(),
warnings: z.array(warningSchema),
notes: z.string(),
model: z.string(),
});

const errorResponseSchema=z.object({
error: z.string(),
message: z.string(),
request_id: z.string().optional(),
});

export interface DraftOutcome {
state: AuraState;
rawDraft: unknown;
warnings: Warning[];
notes: string;
model: string;
}

export class AiDisabledError extends Error {
constructor(){
super(
"Describing an aura in words needs that feature turned on. " +
"You can build any aura by hand without it.",
);
this.name="AiDisabledError";
}
}

export class AiNotConfiguredError extends Error {
constructor(){
super(
"This build has no drafting server configured, so describing in words is " +
"unavailable. Building by hand works normally.",
);
this.name="AiNotConfiguredError";
}
}

export class AiRequestError extends Error {
readonly retryable: boolean;
constructor(message: string, retryable: boolean){
super(message);
this.name="AiRequestError";
this.retryable=retryable;
}
}

export function isAiConfigured(): boolean {
return PROXY_URL.length > 0;
}

export async function describeAura(
description: string,
consented: boolean,
): Promise<DraftOutcome> {
if(!consented) throw new AiDisabledError();
if(!isAiConfigured()) throw new AiNotConfiguredError();

const trimmed=description.trim();
if(trimmed.length < 3){
throw new AiRequestError("Write a sentence or two about what you see.", false);
}
if(trimmed.length > MAX_DESCRIPTION_LENGTH){
throw new AiRequestError(
`That is longer than ${MAX_DESCRIPTION_LENGTH} characters. Try a shorter description.`,
false,
);
}

const controller=new AbortController();
const timer=setTimeout(() => controller.abort(), TIMEOUT_MS);

let response: Response;
try {
response=await fetch(`${PROXY_URL.replace(/\/$/, "")}/v1/describe`, {
method: "POST",
headers: {
"content-type": "application/json",
...(CLIENT_TOKEN ? { "x-cereva-client": CLIENT_TOKEN } : {}),
},
body: JSON.stringify({ description: trimmed }),
signal: controller.signal,
});
}catch(err){
if((err as Error).name === "AbortError"){
throw new AiRequestError("That took too long. Try again in a moment.", true);
}
throw new AiRequestError("Could not reach the server. Check your connection.", true);
}finally {
clearTimeout(timer);
}

let body: unknown;
try {
body=await response.json();
}catch {
throw new AiRequestError("The server sent something unreadable.", true);
}

if(!response.ok){
const parsed=errorResponseSchema.safeParse(body);
if(parsed.success){
throw new AiRequestError(parsed.data.message, response.status >= 500 || response.status === 429);
}
throw new AiRequestError(
`The server returned an error (${response.status}).`,
response.status >= 500,
);
}

const parsed=describeResponseSchema.safeParse(body);
if(!parsed.success){
throw new AiRequestError("The server sent a draft this app could not read.", false);
}

if(parsed.data.schema_version !== CURRENT_SCHEMA_VERSION){
throw new AiRequestError(
`The server is on schema version ${parsed.data.schema_version} and this app ` +
`is on ${CURRENT_SCHEMA_VERSION}. One of them needs updating.`,
false,
);
}

const draftLayers =
typeof parsed.data.draft === "object" && parsed.data.draft !== null
? (parsed.data.draft as { layers?: unknown }).layers
: undefined;
const { state, warnings }=normalizeAuraState({ layers: draftLayers });

const srvWarns: Warning[]=parsed.data.warnings.map((w) => ({
kind: w.kind as Warning["kind"],
path: w.path,
message: w.message,
}));

return {
state,
rawDraft: parsed.data.raw_draft,
warnings: [...srvWarns, ...warnings],
notes: parsed.data.notes,
model: parsed.data.model,
};
}

export function notableWarnings(warnings: Warning[]): Warning[] {
return warnings.filter(
(w) => w.kind === "clamped" || w.kind === "unknown_layer" || w.kind === "list_truncated",
);
}
