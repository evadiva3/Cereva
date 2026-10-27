
import { getDb } from "@/db";

export interface AiConsentState {
granted: boolean;
grantedAt: string | null;
}

export async function getAiConsent(): Promise<AiConsentState> {
const db=await getDb();
const row=await db.getFirstAsync<{ ai_consent: number; ai_consent_at: string | null }>(
"SELECT ai_consent, ai_consent_at FROM settings WHERE id = 1",
);
return {
granted: !!row?.ai_consent,
grantedAt: row?.ai_consent_at ?? null,
};
}

export async function setAiConsent(granted: boolean): Promise<AiConsentState> {
const db=await getDb();
const now=new Date().toISOString();
await db.runAsync(
`UPDATE settings
        SET ai_consent = ?,
            ai_consent_at=?,
            updated_at=?
      WHERE id = 1`,
granted ? 1 : 0,
granted ? now : null,
now,
);
return { granted, grantedAt: granted ? now : null };
}

export const AI_CONSENT_COPY={
title: "Describing your aura in words",
body: [
"You can type or say what you see, and have a draft built for you to adjust.",
"To do that, the words you write are sent to a server run by this app, which passes them to a language model.",
"Only the text you review on the draft screen is sent. You can bring in a selected attack transcript and edit it first. Your other attack records, check-ins, saved auras, name and Apple Health data are not sent.",
"The server keeps no record of what you wrote or what came back.",
"The draft is a starting point, not a reading of your symptoms. You adjust it by hand afterwards, and what you change is kept separately from what was suggested.",
"You can turn this off at any time in settings. Building an aura by hand works fully without it.",
],
acceptLabel: "Turn on describing in words",
declineLabel: "Not now",
} as const;
