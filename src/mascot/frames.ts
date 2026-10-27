import type { ImageSourcePropType } from "react-native";
export type MascotMood="idle" | "happy" | "resting" | "with_you";
export const ATLASES=[
{ source: require("../../assets/mascot/cereva-walk.png") as ImageSourcePropType, columns: 4, rows: 2 },
{ source: require("../../assets/mascot/cereva-wave.png") as ImageSourcePropType, columns: 4, rows: 2 },
] as const;
export type Pose={ atlas: 0 | 1; frame: number; blend: number; hold: number };
export const REST: Pose={ atlas: 1, frame: 0, blend: 350, hold: 5000 };
export const WALK: readonly Pose[]=Array.from({ length: 8 }, (_, frame) => ({ atlas: 0, frame, blend: 70, hold: 55 }));
export const WAVE: readonly Pose[]=[
REST,
...[1, 2, 3, 4, 5, 4, 5, 6, 7].map(frame => ({ atlas: 1 as const, frame, blend: 160, hold: 70 })),
];
