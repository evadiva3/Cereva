
import type { ImageSourcePropType } from "react-native";

export type MascotMood="idle" | "happy" | "resting" | "with_you";

export interface MoodFrames {
frames: ImageSourcePropType[];
fps: number;
loop: boolean;
}

export const MASCOT: Partial<Record<MascotMood, MoodFrames>>={};

export function moodFrames(mood: MascotMood): MoodFrames | null {
return MASCOT[mood] ?? MASCOT.idle ?? null;
}

export function hasMascot(): boolean {
return Object.keys(MASCOT).length > 0;
}
