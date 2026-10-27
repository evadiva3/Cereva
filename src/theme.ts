
export const colors={
canvas: "#090b0c",
surface: "#131618",
surfaceRaised: "#1c2023",
line: "#2a2f33",
lineStrong: "#3a4146",

text: "#e8ecef",
textMuted: "#a0a9b0",
textFaint: "#7a838a",

accent: "#9dcbdd",
accentDim: "#5a7c8a",
accentText: "#0a0e10",

warn: "#d9a05b",
danger: "#c87a7a",

auraBackdrop: "#000000",
} as const;

export const space={
xs: 4,
sm: 8,
md: 12,
lg: 16,
xl: 24,
xxl: 32,
} as const;

export const radius={
sm: 6,
md: 10,
lg: 16,
pill: 999,
} as const;

export const touch={
min: 44,
comfortable: 56,
} as const;

export const type={
display: 28,
title: 22,
heading: 17,
body: 16,
label: 14,
caption: 13,
} as const;

export const motion={
quick: 120,
normal: 200,
slow: 320,
} as const;

export const SAFETY_NOTE =
"Sudden new or different visual symptoms, especially with weakness, " +
"numbness, trouble speaking, or loss of vision, need emergency care. " +
"This app never evaluates your symptoms and never tells you anything is safe.";

export const AURA_DISCLAIMER =
"This is a personal representation you built. It is not a measurement and " +
"not a diagnosis.";

export const cardDepth={
borderWidth: 1,
borderColor: "#2d363c",
borderTopColor: "#46535b",
borderBottomColor: "#080b0d",
shadowColor: "#000000",
shadowOffset: { width: 0, height: 6 },
shadowOpacity: 0.32,
shadowRadius: 10,
elevation: 5,
} as const;
