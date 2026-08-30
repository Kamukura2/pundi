import { access, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const android = resolve(root, "android");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA || "", "Android", "Sdk");
if (!sdk) throw new Error("Android SDK path is not configured.");
try { await access(sdk); } catch { throw new Error(`Android SDK path is unavailable: ${sdk}`); }
await writeFile(resolve(android, "local.properties"), `sdk.dir=${sdk.replaceAll("\\", "/")}\n`, "utf8");

const wrapper = resolve(android, "gradlew.bat");
await access(wrapper);
const bundledJavaHome = join(process.env.LOCALAPPDATA || "", "Programs", "Microsoft", "jdk-21.0.12");
const javaHome = await access(join(bundledJavaHome, "bin", "java.exe")).then(() => bundledJavaHome).catch(() => process.env.JAVA_HOME || "");
try { await access(join(javaHome, "bin", "java.exe")); } catch { throw new Error("JDK 21 is required by Capacitor 8."); }
const gradleJavaPath = javaHome.replaceAll("\\", "/");
const command = `call android\\gradlew.bat -p android -Dorg.gradle.java.installations.paths=${gradleJavaPath} assembleRelease`;
const child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/c", command], {
  cwd: root,
  stdio: "inherit",
  windowsHide: true,
  shell: false,
  env: { ...process.env, JAVA_HOME:javaHome, PATH:`${join(javaHome, "bin")};${process.env.PATH || ""}` }
});
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
