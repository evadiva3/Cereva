import { defineConfig, type Plugin } from "vite";

function inlineEverything(): Plugin {
return {
name: "scintilla-inline-everything",
enforce: "post",
generateBundle(_options, bundle){
const htmlKey=Object.keys(bundle).find((k) => k.endsWith(".html"));
if(!htmlKey){
this.error("no HTML asset was emitted, so there is nothing to inline into");
return;
}
const htmlAsset=bundle[htmlKey];
if(htmlAsset.type !== "asset"){
this.error(`${htmlKey} was emitted as a chunk rather than an asset`);
return;
}
let html=String(htmlAsset.source);
const consumed: string[]=[];
for(const [key, output] of Object.entries(bundle)){
if(key === htmlKey) continue;
if(output.type === "chunk"){
const tag=new RegExp(
`<script[^>]*src="[^"]*${escapeRegExp(key)}"[^>]*></script>`,
);
if(!tag.test(html)){
this.error(
`chunk ${key} was emitted but no matching script tag was found ` +
`in ${htmlKey}, so it would be silently dropped`,
);
return;
}
html=html.replace(
tag,
`<script type="module">\n${output.code}\n</script>`,
);
consumed.push(key);
}else if(key.endsWith(".css")){
const tag=new RegExp(
`<link[^>]*href="[^"]*${escapeRegExp(key)}"[^>]*>`,
);
if(!tag.test(html)){
this.error(
`stylesheet ${key} was emitted but no matching link tag was ` +
`found in ${htmlKey}`,
);
return;
}
html=html.replace(tag, `<style>\n${String(output.source)}\n</style>`);
consumed.push(key);
}
}
for(const key of consumed) delete bundle[key];
const remoteRef=/(?:src|href)\s*=\s*["']https?:\/\//i.exec(html);
if(remoteRef){
this.error(
`the built HTML references a remote resource (${remoteRef[0]}), ` +
"which the zero-network rule forbids",
);
return;
}
htmlAsset.source=html;
},
};
}
function escapeRegExp(s: string): string {
return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
export default defineConfig({
plugins: [inlineEverything()],
build: {
outDir: "dist",
emptyOutDir: true,
assetsInlineLimit: 100_000_000,
cssCodeSplit: false,

target: "safari16",
codeSplitting: false,
},
});
