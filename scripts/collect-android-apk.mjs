import { access, copyFile, mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
const outputDir = resolve(root, "dist", "android");
const target = resolve(outputDir, "pundi-android-alpha-v1.apk");

try { await access(source); } catch { throw new Error(`Release APK missing: ${source}`); }
await mkdir(outputDir, { recursive:true });
await rm(target, { force:true });
await copyFile(source, target);
const { size } = await stat(target);
if (size < 100_000) throw new Error("Release APK is unexpectedly small.");
console.log(JSON.stringify({ status:"PASS", apk:target, size }));
