export type CameraStatus =
| "idle"
| "requesting"
| "live"
| "denied"
| "unsupported"
| "timeout"
| "error";
export interface CameraDiagnostics {
status: CameraStatus;
mediaDevicesPresent: boolean;
secureContext: boolean;
origin: string;

errorName: string | null;
errorMessage: string | null;
videoWidth: number;
videoHeight: number;
}
const REQUEST_TIMEOUT_MS=8000;
export class CameraSource {
private video: HTMLVideoElement | null = null;
private stream: MediaStream | null = null;
private status: CameraStatus = "idle";
private errorName: string | null = null;
private errorMessage: string | null = null;
private pending: Promise<CameraDiagnostics> | null = null;
start(): Promise<CameraDiagnostics> {
if(this.status === "live") return Promise.resolve(this.diagnostics());
if(this.pending) return this.pending;
this.pending=this.request().finally(() => {
this.pending=null;
});
return this.pending;
}
private async request(): Promise<CameraDiagnostics> {
this.errorName=null;
this.errorMessage=null;
const md=typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
if(!md || typeof md.getUserMedia !== "function"){
this.status="unsupported";
this.errorMessage =
"navigator.mediaDevices is unavailable, which usually means the page " +
"is not a secure context";
return this.diagnostics();
}
this.status="requesting";
let timer=0;
try {
const stream=await Promise.race([
md.getUserMedia({
video: { facingMode: { ideal: "environment" } },
audio: false,
}),
new Promise<never>((_, reject) => {
timer=self.setTimeout(
() => reject(new DOMException("getUserMedia did not settle", "TimeoutError")),
REQUEST_TIMEOUT_MS,
);
}),
]);
this.stream=stream;
this.video=await this.attach(stream);
this.status="live";
}catch(err){
const e=err as DOMException;
this.errorName=e?.name ?? "Error";
this.errorMessage=e?.message ?? String(err);
this.status =
e?.name === "TimeoutError"
? "timeout"
: e?.name === "NotAllowedError" || e?.name === "SecurityError"
? "denied"
: "error";
}finally {
if(timer) clearTimeout(timer);
}
return this.diagnostics();
}
private attach(stream: MediaStream): Promise<HTMLVideoElement> {
const video=document.createElement("video");
video.srcObject=stream;
video.muted=true;
video.playsInline=true;
video.setAttribute("playsinline", "");
video.setAttribute("muted", "");
video.style.position="absolute";
video.style.width="1px";
video.style.height="1px";
video.style.opacity="0";
video.style.pointerEvents="none";
video.style.left="-10px";
video.style.top="-10px";
document.body.appendChild(video);
return new Promise((resolve, reject) => {
const ready=() => {
if(video.videoWidth > 0 && video.videoHeight > 0){
resolve(video);
}
};
video.onloadedmetadata=ready;
video.onresize=ready;
video.onerror=() => reject(new DOMException("video element failed", "Error"));
video.play().then(ready).catch(reject);
});
}
stop(): void {
this.stream?.getTracks().forEach((t) => t.stop());
this.stream=null;
if(this.video){
this.video.srcObject=null;
this.video.remove();
this.video=null;
}
this.status="idle";
}

frameSource(): HTMLVideoElement | null {
return this.status === "live" ? this.video : null;
}
isLive(): boolean {
return this.status === "live";
}
diagnostics(): CameraDiagnostics {
return {
status: this.status,
mediaDevicesPresent:
typeof navigator !== "undefined" &&
!!navigator.mediaDevices &&
typeof navigator.mediaDevices.getUserMedia === "function",
secureContext: typeof self !== "undefined" ? !!self.isSecureContext : false,
origin: typeof location !== "undefined" ? location.origin || location.protocol : "unknown",
errorName: this.errorName,
errorMessage: this.errorMessage,
videoWidth: this.video?.videoWidth ?? 0,
videoHeight: this.video?.videoHeight ?? 0,
};
}
}
