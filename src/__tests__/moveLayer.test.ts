import { canMove, moveConfig } from "../aura/moveLayer";

describe("moving a layer by hand", () => {
it("knows a layer with no position cannot be dragged", () => {
expect(canMove({ density: 5000, opacity: 0.4 })).toBe(false);
expect(canMove(null)).toBe(false);
expect(canMove("nonsense")).toBe(false);
});

it("knows a layer with a centre can be dragged", () => {
expect(canMove({ center_x: 0.5, center_y: 0.5 })).toBe(true);
});

it("knows a layer with positioned items can be dragged", () => {
expect(canMove({ scotomas: [{ x: 0.2, y: 0.3, size: 0.1 }] })).toBe(true);
});

it("moves a centre by the delta", () => {
const out=moveConfig({ center_x: 0.5, center_y: 0.5 }, 0.1, -0.2);
expect(out.center_x).toBeCloseTo(0.6);
expect(out.center_y).toBeCloseTo(0.3);
});

it("moves every item together so the shape holds", () => {
const out=moveConfig(
{ scotomas: [{ x: 0.2, y: 0.2 }, { x: 0.4, y: 0.6 }] },
0.1,
0.1,
);
expect(out.scotomas[0]).toMatchObject({ x: 0.30000000000000004, y: 0.30000000000000004 });
expect(out.scotomas[1]!.x).toBeCloseTo(0.5);
expect(out.scotomas[1]!.y).toBeCloseTo(0.7);
});

it("never lets a position leave the screen", () => {
const out=moveConfig({ scotomas: [{ x: 0.9, y: 0.1 }] }, 0.5, -0.5);
expect(out.scotomas[0]!.x).toBe(1);
expect(out.scotomas[0]!.y).toBe(0);
});

it("leaves every other field untouched", () => {
const out=moveConfig(
{ scotomas: [{ x: 0.5, y: 0.5, size: 0.2, seed: 7 }], fill_color: "#000000" },
0.1,
0,
);
expect(out.fill_color).toBe("#000000");
expect(out.scotomas[0]!.size).toBe(0.2);
expect(out.scotomas[0]!.seed).toBe(7);
});

it("does not mutate the original", () => {
const original={ scotomas: [{ x: 0.5, y: 0.5 }] };
moveConfig(original, 0.2, 0.2);
expect(original.scotomas[0]!.x).toBe(0.5);
});
});
