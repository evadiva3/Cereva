
import { Directory, File, Paths } from "expo-file-system";

function auraDirectory(): Directory {
const dir=new Directory(Paths.document, "auras");
if(!dir.exists) dir.create({ intermediates: true });
return dir;
}

function stripDataUrl(dataUrl: string): string {
const comma=dataUrl.indexOf(",");
return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function writeAuraImage(dataUrl: string, name: string): string {
const file=new File(auraDirectory(), name);
if(file.exists) file.delete();
file.create();
file.write(stripDataUrl(dataUrl), { encoding: "base64" });
return file.uri;
}

export function writeShareImage(dataUrl: string, name = "aura-share.png"): string {
const file=new File(Paths.cache, name);
if(file.exists) file.delete();
file.create();
file.write(stripDataUrl(dataUrl), { encoding: "base64" });
return file.uri;
}

export function deleteFileQuietly(uri: string | null | undefined): void {
if(!uri) return;
try {
const file=new File(uri);
if(file.exists) file.delete();
}catch {}
}

export function deleteAllAuraImages(): void {
try {
const dir=new Directory(Paths.document, "auras");
if(dir.exists) dir.delete();
}catch {}
}
