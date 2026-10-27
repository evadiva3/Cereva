
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { WebViewSource } from "react-native-webview/lib/WebViewTypes";

import {
envelope,
parseRendererMessage,
type AuraState,
type BackgroundConfig,
type CameraReport,
type FrameStats,
type HostMessage,
type RendererCapabilities,
type Warning,
} from "@aura/schema";
import { colors } from "@/theme";
import { fileRendererSource, getRendererSource, rendererUri } from "./rendererSource";

export interface AuraViewHandle {
setState(state: AuraState): void;
setBackground(background: BackgroundConfig): void;
setMotion(pointer: { x: number; y: number } | null): void;
setQuality(q: { maxDpr?: number; depthOfField?: boolean }): void;
startCamera(): void;
stopCamera(): void;
snapshot(scale?: number): Promise<{ dataUrl: string; width: number; height: number }>;
recordGif(opts?: { frames?: number; fps?: number; scale?: number }): Promise<{
dataUrl: string;
width: number;
height: number;
frames: number;
}>;
measure(seconds: number): Promise<FrameStats>;
}

export interface AuraViewProps {
style?: StyleProp<ViewStyle>;
onReady?: (capabilities: RendererCapabilities) => void;
onWarnings?: (warnings: Warning[]) => void;
onCamera?: (report: CameraReport) => void;
onError?: (message: string) => void;
pointerEventsNone?: boolean;
}

interface PendingRequest {
resolve: (value: never) => void;
reject: (reason: Error) => void;
kind: "snapshot" | "stats" | "gif";
timer: ReturnType<typeof setTimeout>;
}

const REQUEST_TIMEOUT_MS=10_000;

const GIF_TIMEOUT_MS=60_000;

export const AuraView=forwardRef<AuraViewHandle, AuraViewProps>(function AuraView(
{ style, onReady, onWarnings, onCamera, onError, pointerEventsNone },
ref,
){
const webRef=useRef<WebView>(null);
const [source, setSource]=useState<WebViewSource | null>(null);
const readyRef=useRef(false);
const queueRef=useRef<HostMessage[]>([]);
const seqRef=useRef(0);
const pendingRef=useRef(new Map<string, PendingRequest>());

const didFallback=useRef(false);
const cb=useRef({ onReady, onWarnings, onCamera, onError });
cb.current={ onReady, onWarnings, onCamera, onError };

useEffect(() => {
let cancelled=false;
getRendererSource()
.then((s) => {
if(!cancelled) setSource(s);
})
.catch((err: Error) => cb.current.onError?.(err.message));
return () => {
cancelled=true;
};
}, []);

useEffect(() => {
const pending=pendingRef.current;
return () => {
for(const p of pending.values()){
clearTimeout(p.timer);
p.reject(new Error("The aura view closed before the request finished."));
}
pending.clear();
};
}, []);

const rawSend=useCallback((body: HostMessage, id: string) => {
const text=JSON.stringify(envelope(id, body));
webRef.current?.postMessage(text);
}, []);

const send=useCallback(
(body: HostMessage): string => {
const id=`h${++seqRef.current}`;
if(!readyRef.current){
queueRef.current.push(body);
return id;
}
rawSend(body, id);
return id;
},
[rawSend],
);

const request=useCallback(
<T,>(body: HostMessage, kind: PendingRequest["kind"], timeoutMs=REQUEST_TIMEOUT_MS): Promise<T> => {
if(!readyRef.current){
return Promise.reject(
new Error("The renderer is not ready yet. Wait for onReady."),
);
}
const id=`h${++seqRef.current}`;
return new Promise<T>((resolve, reject) => {
const timer=setTimeout(() => {
pendingRef.current.delete(id);
reject(new Error(`The renderer did not answer the ${kind} request in time.`));
}, timeoutMs);
pendingRef.current.set(id, {
resolve: resolve as (value: never) => void,
reject,
kind,
timer,
});
rawSend(body, id);
});
},
[rawSend],
);

const handleMessage=useCallback((event: WebViewMessageEvent) => {
const parsed=parseRendererMessage(event.nativeEvent.data);
if(!parsed.ok){
cb.current.onError?.(`${parsed.code}: ${parsed.message}`);
return;
}
const { body, replyTo }=parsed.value;

if(replyTo){
const pending=pendingRef.current.get(replyTo);
if(pending){
pendingRef.current.delete(replyTo);
clearTimeout(pending.timer);
if(body.type === "snapshot" && pending.kind === "snapshot"){
pending.resolve({
dataUrl: body.dataUrl,
width: body.width,
height: body.height,
} as never);
return;
}
if(body.type === "gif" && pending.kind === "gif"){
pending.resolve({
dataUrl: body.dataUrl,
width: body.width,
height: body.height,
frames: body.frames,
} as never);
return;
}
if(body.type === "stats" && pending.kind === "stats"){
pending.resolve(body.stats as never);
return;
}
if(body.type === "error"){
pending.reject(new Error(`${body.code}: ${body.message}`));
return;
}
}
}

switch(body.type){
case "ready": {
readyRef.current=true;
const queued=queueRef.current;
queueRef.current=[];
for(const m of queued) rawSend(m, `h${++seqRef.current}`);
cb.current.onReady?.(body.capabilities);
return;
}
case "accepted":
if(body.warnings.length > 0) cb.current.onWarnings?.(body.warnings);
return;
case "camera":
cb.current.onCamera?.(body.report);
return;
case "error":
cb.current.onError?.(`${body.code}: ${body.message}`);
return;
default:
return;
}
}, [rawSend]);

useImperativeHandle(
ref,
(): AuraViewHandle => ({
setState: (state) => void send({ type: "setState", state }),
setBackground: (background) => void send({ type: "setBackground", background }),
setMotion: (pointer) => void send({ type: "setMotion", pointer }),
setQuality: (q) => void send({ type: "setQuality", ...q }),
startCamera: () => void send({ type: "startCamera" }),
stopCamera: () => void send({ type: "stopCamera" }),
snapshot: (scale) =>
request(
scale === undefined
? { type: "requestSnapshot" }
: { type: "requestSnapshot", scale },
"snapshot",
),
recordGif: (opts) =>
request(
{ type: "requestGif", ...(opts ?? {}) },
"gif",
GIF_TIMEOUT_MS,
),
measure: async (seconds) => {
send({ type: "resetStats" });
await new Promise((r) => setTimeout(r, seconds * 1000));
return request<FrameStats>({ type: "requestStats" }, "stats");
},
}),
[send, request],
);

if(!source){
return <View style={[styles.placeholder, style]} />;
}

return (
<View style={[styles.container, style]} pointerEvents={pointerEventsNone ? "none" : "auto"}>
<WebView
ref={webRef}
source={source}
onMessage={handleMessage}
scrollEnabled={false}
bounces={false}
overScrollMode="never"
allowsInlineMediaPlayback
mediaPlaybackRequiresUserAction={false}
mediaCapturePermissionGrantType="grant"
originWhitelist={["file://*", "http://localhost*", "http://127.0.0.1*", "about:*"]}
onShouldStartLoadWithRequest={(req) => {
const ok =
req.url.startsWith("about:") ||
req.url.startsWith("file:") ||
req.url.startsWith("data:") ||
req.url.startsWith("http://localhost") ||
req.url.startsWith("http://127.0.0.1");
if(!ok){
cb.current.onError?.(`Blocked a navigation to ${req.url}`);
}
return ok;
}}
javaScriptEnabled
domStorageEnabled={false}
cacheEnabled={false}
incognito
setSupportMultipleWindows={false}
allowsBackForwardNavigationGestures={false}
style={styles.web}
containerStyle={styles.web}
onRenderProcessGone={() =>
cb.current.onError?.("The renderer stopped unexpectedly. Reopen this screen.")
}
onError={(e) => {
if(!didFallback.current){
didFallback.current=true;
cb.current.onError?.(
`Could not load the renderer from ${rendererUri()}, using the bundled ` +
"copy instead. The camera stays off.",
);
void fileRendererSource().then(setSource).catch(() => {});
return;
}
cb.current.onError?.(`The renderer failed to load: ${e.nativeEvent.description}`);
}}
/>
</View>
);
});

const styles=StyleSheet.create({
container: { flex: 1, backgroundColor: colors.canvas, overflow: "hidden" },
placeholder: { flex: 1, backgroundColor: colors.canvas },
web: { flex: 1, backgroundColor: colors.canvas },
});
