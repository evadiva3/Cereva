
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT=fileURLToPath(new URL("..", import.meta.url));
const SRC=join(ROOT, "renderer", "dist", "index.html");
const DEST=join(ROOT, "assets", "renderer", "index.html");

let html;
try {
html=readFileSync(SRC, "utf8");
}catch {
console.error(
`No built renderer at ${SRC}.\nRun: npm --prefix renderer run build`,
);
process.exit(1);
}

const remote=/(?:src|href)\s*=\s*["']https?:\/\//i.exec(html);
if(remote){
console.error(
`The built renderer references a remote resource (${remote[0]}).\n` +
"The renderer is not allowed to touch the network. Refusing to ship it.",
);
process.exit(1);
}

const banned=[0x2014, 0x2013, 0x2212, 0x2015].map((c) => String.fromCodePoint(c));
const found=banned.filter((c) => html.includes(c));
if(found.length){
console.error(
`The built renderer contains banned dash characters: ${found.join(" ")}\n` +
"Run the de-dash pass over renderer/src and rebuild.",
);
process.exit(1);
}

mkdirSync(dirname(DEST), { recursive: true });
copyFileSync(SRC, DEST);
const kb=(statSync(DEST).size / 1024).toFixed(1);
console.log(`renderer bundle synced to assets/renderer/index.html (${kb} kB)`);
