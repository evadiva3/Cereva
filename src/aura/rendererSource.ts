
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import type { WebViewSource } from "react-native-webview/lib/WebViewTypes";

export type LoadStrategy = "inline_html" | "bundle_file" | "loopback_http";

const ORIGIN_OVERRIDE=process.env.EXPO_PUBLIC_RENDERER_ORIGIN ?? "";

const TRY_LOOPBACK=process.env.EXPO_PUBLIC_RENDERER_LOOPBACK === "1";

export const LOAD_STRATEGY: LoadStrategy=TRY_LOOPBACK ? "loopback_http" : "bundle_file";

const RENDERER_ASSET=require("../../assets/renderer/index.html") as number;

let cachedSource: WebViewSource | null=null;

let lastFallbackReason: string | null=null;

export function rendererFallbackReason(): string | null {
return lastFallbackReason;
}

export function rendererUri(): string {
if(!cachedSource) return "(not resolved)";
return "uri" in cachedSource ? String(cachedSource.uri) : "(inline html)";
}

export async function getRendererSource(): Promise<WebViewSource> {
if(cachedSource) return cachedSource;

const asset=Asset.fromModule(RENDERER_ASSET);
await asset.downloadAsync();

if(LOAD_STRATEGY === "inline_html"){
const uri=asset.localUri ?? asset.uri;
const html=await FileSystem.readAsStringAsync(uri);
cachedSource={ html, baseUrl: "http://localhost/" };
return cachedSource;
}

if(LOAD_STRATEGY === "bundle_file"){
const uri=asset.localUri ?? asset.uri;
if(!uri){
throw new Error(
"The renderer asset has no local URI. Run: npm run renderer:build",
);
}
cachedSource={ uri };
return cachedSource;
}

if(LOAD_STRATEGY === "loopback_http"){
if(ORIGIN_OVERRIDE){
cachedSource={ uri: ORIGIN_OVERRIDE };
return cachedSource;
}
try {
const { rendererOrigin }=await import("./localServer");
const url=await rendererOrigin();
cachedSource={ uri: url };
return cachedSource;
}catch(err){
lastFallbackReason=(err as Error).message;
const uri=asset.localUri ?? asset.uri;
if(!uri) throw err;
cachedSource={ uri };
return cachedSource;
}
}

throw new Error(`Unknown renderer load strategy "${LOAD_STRATEGY}".`);
}

export async function fileRendererSource(): Promise<WebViewSource> {
const asset=Asset.fromModule(RENDERER_ASSET);
await asset.downloadAsync();
const uri=asset.localUri ?? asset.uri;
if(!uri) throw new Error("the renderer asset has no local URI");
cachedSource={ uri };
return cachedSource;
}
