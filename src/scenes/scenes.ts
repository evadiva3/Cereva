
import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import type { ImageSourcePropType } from "react-native";

export interface Scene {
id: string;
label: string;
hint: string;
source: ImageSourcePropType;
}

export const SCENES: Scene[]=[];

export function hasScenes(): boolean {
return SCENES.length > 0;
}

const cache=new Map<string, string>();

export async function sceneDataUri(scene: Scene): Promise<string> {
const hit=cache.get(scene.id);
if(hit) return hit;

const asset=Asset.fromModule(scene.source as number);
await asset.downloadAsync();
const uri=asset.localUri ?? asset.uri;
if(!uri) throw new Error("the scene image could not be loaded");

const mime=uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
const data=`data:${mime};base64,${new File(uri).base64Sync()}`;
cache.set(scene.id, data);
return data;
}
