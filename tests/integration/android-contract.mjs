import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const read = file => readFileSync(resolve(root, file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const capacitorConfig = read("capacitor.config.ts");
const androidGradle = read("android/app/build.gradle");
const manifest = read("android/app/src/main/AndroidManifest.xml");
const runtime = read("src/lib/runtime.js");
const app = read("app.js");
const sync = read("src/sync/sync-manager.js");
const stocks = read("src/stocks/client.js");
const crypto = read("src/crypto/binance.js");
const supabase = read("src/lib/supabase.js");
const nativeShell = read("src/lib/native-shell.js");
const http = read("api/_lib/http.js");
const configApi = read("api/config.js");
const docs = read("docs/ANDROID.md");
const strings = read("android/app/src/main/res/values/strings.xml");
const apkPath = resolve(root, "dist/android/pundi-android-alpha-v1.apk");

assert.equal(packageJson.version, "8.7.2");
assert.equal(packageJson.scripts["android:sync"], "npm run build && node scripts/prepare-android-web.mjs && npx cap sync android");
assert.equal(packageJson.scripts["android:apk"], "npm run android:sync && node scripts/android-signing.mjs && node scripts/run-android-gradle.mjs && node scripts/collect-android-apk.mjs");
assert.equal(packageJson.scripts["test:android"], "node tests/integration/android-contract.mjs");
for (const name of ["@capacitor/core", "@capacitor/android", "@capacitor/app", "@capacitor/browser", "@capacitor/filesystem", "@capacitor/keyboard", "@capacitor/share", "@capacitor/splash-screen", "@capacitor/status-bar"]) assert.ok(packageJson.dependencies[name], `Missing Capacitor dependency ${name}`);
assert.ok(packageJson.devDependencies["@capacitor/cli"], "Missing Capacitor CLI");

for (const marker of [
  'appId: "online.pundi.app"',
  'appName: "Pundi"',
  'webDir: "dist"',
  'hostname: "localhost"',
  'androidScheme: "https"'
]) assert.match(capacitorConfig, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")), `Capacitor config missing ${marker}`);
assert.doesNotMatch(capacitorConfig, /server\s*:\s*\{[^}]*url\s*:/s, "Native app must use bundled assets, not server.url");
assert.match(androidGradle, /namespace\s*[=:]\s*["']online\.pundi\.app["']/);
assert.match(androidGradle, /applicationId\s*["']online\.pundi\.app["']/);
assert.match(androidGradle, /versionCode\s+80703/);
assert.match(androidGradle, /versionName\s+["']8\.7\.2["']/);
assert.match(strings, /<string name="app_name">Pundi<\/string>/);
assert.match(manifest, /android:theme="@style\/AppTheme"/);
assert.doesNotMatch(manifest, /Nook|CVFinance|cvfinance/i);

for (const marker of ["https://app.pundi.online", "isNativePlatform", "apiUrl", "authRedirectOrigin"]) assert.match(runtime, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")));
for (const source of [app, sync, stocks, crypto, supabase]) assert.match(source, /apiUrl/);
assert.match(nativeShell, /Browser\.open/);
assert.match(nativeShell, /StatusBar/);
assert.match(nativeShell, /App\.addListener/);
assert.match(nativeShell, /__pundiHandleNativeBack/);
assert.match(http, /https:\/\/localhost/);
assert.match(configApi, /nativeCors/);
assert.match(app, /!isNativeRuntime\(\).*serviceWorker/);
assert.match(supabase, /apiUrl\("\/api\/config"\)/);
assert.match(sync, /authRedirectOrigin\(\)/);
assert.match(docs, /Android Alpha 1/);
assert.match(docs, /online\.pundi\.app/);
assert.match(docs, /AAB|Play Store/);

assert.ok(existsSync(apkPath), `Canonical APK missing: ${apkPath}`);
assert.ok(statSync(apkPath).size > 100_000, "Canonical APK is unexpectedly small");
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || "C:/Users/delly/AppData/Local/Android/Sdk";
const analyzer = resolve(sdk, "cmdline-tools/latest/bin/apkanalyzer.bat");
const runBat = (script, args) => execFileSync(process.env.ComSpec || "cmd.exe", ["/d", "/c", "call", script, ...args], { encoding: "utf8", windowsHide: true });
const dump = runBat(analyzer, ["manifest", "application-id", apkPath]).trim();
assert.equal(dump, "online.pundi.app");
const versionName = runBat(analyzer, ["manifest", "version-name", apkPath]).trim();
assert.equal(versionName, "8.7.2");
const versionCode = runBat(analyzer, ["manifest", "version-code", apkPath]).trim();
assert.equal(versionCode, "80703");
const minSdk = runBat(analyzer, ["manifest", "min-sdk", apkPath]).trim();
const targetSdk = runBat(analyzer, ["manifest", "target-sdk", apkPath]).trim();
assert.equal(minSdk, "24");
assert.equal(targetSdk, "36");
const apksigner = resolve(sdk, "build-tools/36.0.0/apksigner.bat");
runBat(apksigner, ["verify", apkPath]);
const artifact = readFileSync(apkPath);
const forbidden = [/SUPABASE_SERVICE_ROLE_KEY/i, /SUPABASE_SERVICE_ROLE/i, /PUNDI_ADMIN_SMOKE_PASSWORD/i, /PUNDI_USER_SMOKE_PASSWORD/i, /service_role_key/i, /DB_PASSWORD/i, /BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY/i, /Nook/i, /CVFINANCE/i];
for (const pattern of forbidden) assert.doesNotMatch(artifact.toString("latin1"), pattern, `Forbidden marker in APK: ${pattern}`);
console.log(JSON.stringify({ status: "PASS", packageId: dump, versionName, versionCode, minSdk, targetSdk, apk: apkPath }));
