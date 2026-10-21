
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import type { WebViewSource } from "react-native-webview/lib/WebViewTypes";

export type LoadStrategy = "inline_html" | "bundle_file" | "loopback_http";

export const LOAD_STRATEGY: LoadStrategy="bundle_file";

const RENDERER_ASSET=require("../../assets/renderer/index.html") as number;

let cachedSource: WebViewSource | null=null;

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

throw new Error(
`Load strategy "${LOAD_STRATEGY}" needs a local static server, which is ` +
"not implemented yet. See docs/CAMERA.md, Test A.",
);
}

export function invalidateRendererSource(): void {
cachedSource=null;
}
