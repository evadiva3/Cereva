
import {
BRIDGE_VERSION,
envelope,
parseHostMessage,
parseRendererMessage,
type HostMessage,
type RendererMessage,
} from "../src/index";

const wrap=(body: unknown, overrides: Record<string, unknown>={}) =>
JSON.stringify({ v: BRIDGE_VERSION, id: "x1", body, ...overrides });

describe("envelope", () => {
it("omits replyTo entirely when there is nothing to reply to", () => {
const e=envelope("a", { type: "ping" } as HostMessage);
expect("replyTo" in e).toBe(false);
});

it("carries replyTo when answering", () => {
const e=envelope("b", { type: "pong" } as RendererMessage, "a");
expect(e.replyTo).toBe("a");
});
});

describe("parseHostMessage", () => {
it("accepts every message type the renderer implements", () => {
const msgs: HostMessage[]=[
{ type: "setState", state: { layers: [] } },
{ type: "setBackground", background: { background_type: "neutral", photo_uri: null } },
{ type: "setMotion", pointer: { x: 1, y: 2 } },
{ type: "setMotion", pointer: null },
{ type: "setQuality", maxDpr: 2, depthOfField: false },
{ type: "requestSnapshot" },
{ type: "requestSnapshot", scale: 2 },
{ type: "startCamera" },
{ type: "stopCamera" },
{ type: "requestStats" },
{ type: "resetStats" },
{ type: "ping" },
];
for(const m of msgs){
const r=parseHostMessage(wrap(m));
expect({ type: m.type, ok: r.ok }).toEqual({ type: m.type, ok: true });
}
});

it("accepts an already-parsed object as well as a JSON string", () => {
expect(parseHostMessage({ v: BRIDGE_VERSION, id: "i", body: { type: "ping" } }).ok).toBe(true);
});

it("rejects a version mismatch with a message a human can act on", () => {
const r=parseHostMessage(wrap({ type: "ping" }, { v: BRIDGE_VERSION + 1 }));
expect(r.ok).toBe(false);
if(!r.ok){
expect(r.code).toBe("version_mismatch");
expect(r.message).toMatch(/rebuild/i);
expect(r.id).toBe("x1");
}
});

it("rejects an unknown message type by name rather than ignoring it", () => {
const r=parseHostMessage(wrap({ type: "selfDestruct" }));
expect(r.ok).toBe(false);
if(!r.ok){
expect(r.code).toBe("unknown_type");
expect(r.message).toContain("selfDestruct");
}
});

it.each([
["not json at all", "bad_envelope"],
['"a string"', "bad_envelope"],
["[1,2,3]", "bad_envelope"],
['{"id":"a","body":{"type":"ping"}}', "bad_envelope"],
['{"v":1,"body":{"type":"ping"}}', "bad_envelope"],
['{"v":1,"id":"a"}', "bad_envelope"],
['{"v":1,"id":"a","body":{}}', "bad_envelope"],
])("rejects %s", (raw, code) => {
const r=parseHostMessage(raw);
expect(r.ok).toBe(false);
if(!r.ok) expect(r.code).toBe(code);
});

it("rejects a malformed setMotion payload", () => {
for(const pointer of [
{ x: "left" },
{ x: 1 },
"middle",
{ x: null, y: 0 },
{ x: 0 },
{ x: "0", y: "0" },
[0, 0],
]){
const r=parseHostMessage(wrap({ type: "setMotion", pointer }));
expect(r.ok).toBe(false);
if(!r.ok) expect(r.code).toBe("bad_payload");
}
});

it("rejects an out-of-range snapshot scale", () => {
for(const scale of [0, -1, 99, "big"]){
const r=parseHostMessage(wrap({ type: "requestSnapshot", scale }));
expect(r.ok).toBe(false);
}
});

it("rejects a non-boolean depthOfField", () => {
const r=parseHostMessage(wrap({ type: "setQuality", depthOfField: "yes" }));
expect(r.ok).toBe(false);
});

it("never throws on hostile input", () => {
const hostile=[
undefined,
null,
0,
"{",
"{}",
'{"v":1,"id":"a","body":{"type":"setState","state":null}}',
Symbol("nope"),
() => undefined,
];
for(const h of hostile){
expect(() => parseHostMessage(h)).not.toThrow();
}
});
});

describe("parseRendererMessage", () => {
const ready={
type: "ready",
bridgeVersion: BRIDGE_VERSION,
schemaVersion: 1,
capabilities: {
layers: ["visual_snow"],
webgl2: true,
canvasFilter: true,
compositeReadingLayers: ["photophobia"],
},
};

it("accepts a well-formed ready", () => {
expect(parseRendererMessage(wrap(ready)).ok).toBe(true);
});

it("rejects a ready whose bridge version disagrees with the envelope", () => {
const r=parseRendererMessage(wrap({ ...ready, bridgeVersion: 99 }));
expect(r.ok).toBe(false);
if(!r.ok) expect(r.code).toBe("version_mismatch");
});

it("rejects a ready with no capabilities", () => {
const r=parseRendererMessage(wrap({ type: "ready", bridgeVersion: BRIDGE_VERSION, schemaVersion: 1 }));
expect(r.ok).toBe(false);
if(!r.ok) expect(r.code).toBe("bad_payload");
});

it("rejects a snapshot that is not actually an image", () => {
for(const dataUrl of ["", "https://example.com/x.png", "data:text/html,<script>", 42]){
const r=parseRendererMessage(wrap({ type: "snapshot", dataUrl, width: 1, height: 1 }));
expect(r.ok).toBe(false);
}
});

it("accepts a real png data URL snapshot", () => {
const r=parseRendererMessage(
wrap({ type: "snapshot", dataUrl: "data:image/png;base64,iVBORw0KGgo=", width: 2, height: 2 }),
);
expect(r.ok).toBe(true);
});

it("rejects an accepted message with no warnings array", () => {
const r=parseRendererMessage(wrap({ type: "accepted", layerCount: 1 }));
expect(r.ok).toBe(false);
});

it("rejects host-only message types arriving from the renderer", () => {
const r=parseRendererMessage(wrap({ type: "setState", state: {} }));
expect(r.ok).toBe(false);
if(!r.ok) expect(r.code).toBe("unknown_type");
});

it("rejects renderer-only message types arriving from the host", () => {
const r=parseHostMessage(wrap(ready));
expect(r.ok).toBe(false);
if(!r.ok) expect(r.code).toBe("unknown_type");
});
});
