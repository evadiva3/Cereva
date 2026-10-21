
export type BackgroundType = "neutral" | "photo" | "camera" | "reading_passage";

export interface BackgroundConfig {
background_type: BackgroundType;
photo_uri: string | null;
}

export const DEFAULT_BACKGROUND: BackgroundConfig={
background_type: "neutral",
photo_uri: null,
};

export const BACKGROUND_LABELS: Record<BackgroundType, string>={
neutral: "Dark field",
photo: "Your photo",
camera: "Live camera",
reading_passage: "Reading page",
};

export function neutralBackground(): BackgroundConfig {
return { background_type: "neutral", photo_uri: null };
}

export function photoBackground(uri: string): BackgroundConfig {
return { background_type: "photo", photo_uri: uri };
}

export function cameraBackground(): BackgroundConfig {
return { background_type: "camera", photo_uri: null };
}

export function readingPassageBackground(): BackgroundConfig {
return { background_type: "reading_passage", photo_uri: null };
}
