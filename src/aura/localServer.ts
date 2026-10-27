
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { start, stop, respond } from "react-native-http-bridge-refurbished";

const RENDERER_ASSET=require("../../assets/renderer/index.html") as number;

const PORT=18520;

let origin: string | null=null;
let starting: Promise<string> | null=null;

async function loadHtml(): Promise<string> {
const asset=Asset.fromModule(RENDERER_ASSET);
await asset.downloadAsync();
const uri=asset.localUri ?? asset.uri;
if(!uri) throw new Error("the renderer asset has no local URI");
return new File(uri).textSync();
}

async function reachable(url: string, tries=10): Promise<boolean> {
for(let i = 0; i < tries; i++){
try {
const res=await fetch(url, { method: "GET" });
if(res.ok) return true;
}catch {}
await new Promise((r) => setTimeout(r, 150));
}
return false;
}

export async function rendererOrigin(): Promise<string> {
if(origin) return origin;
if(starting) return starting;

starting=(async () => {
const html=await loadHtml();

if(typeof start !== "function" || typeof respond !== "function"){
throw new Error("the local http server module did not load");
}

start(PORT, "cereva-renderer", (req) => {
try {
respond(req.requestId, 200, "text/html; charset=utf-8", html);
}catch {}
});

const url=`http://127.0.0.1:${PORT}/`;
if(!(await reachable(url))){
try { stop(); }catch {}
throw new Error(`the local http server did not answer on ${url}`);
}

origin=url;
return url;
})();

try {
return await starting;
}catch(err){
starting=null;
origin=null;
throw err;
}
}
