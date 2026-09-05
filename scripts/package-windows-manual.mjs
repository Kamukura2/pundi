import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createPackage } from "@electron/asar";

const root = resolve(import.meta.dirname, "..");
const electronVersion = "44.2.0";
const localAppData = process.env.LOCALAPPDATA || "";
const electronCache = join(localAppData, "electron", "Cache");
const outDir = resolve(root, "artifacts", "windows-manual");
const tempRoot = join(localAppData || resolve(root, "runtime"), `pundi-v32-electron-${Date.now()}`);
const appStage = join(tempRoot, "app");
const electronStage = join(tempRoot, "electron");
const asarPath = join(electronStage, "resources", "app.asar");
const targetExe = join(outDir, "Pundi-8.8.0-Windows-x64.exe");

function findZip(directory) {
  if (!existsSync(directory)) return null;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const candidate = join(directory, entry.name);
    if (entry.isFile() && entry.name === `electron-v${electronVersion}-win32-x64.zip`) return candidate;
    if (entry.isDirectory()) { const nested = findZip(candidate); if (nested) return nested; }
  }
  return null;
}

const electronZip = findZip(electronCache);
if (!electronZip) throw new Error(`Electron ${electronVersion} Windows x64 cache zip is unavailable.`);
if (!existsSync(resolve(root, "dist", "app.html"))) throw new Error("Run the Vite build before packaging Windows.");

rmSync(tempRoot, { recursive: true, force: true });
rmSync(outDir, { recursive: true, force: true });
mkdirSync(appStage, { recursive: true });
mkdirSync(electronStage, { recursive: true });
mkdirSync(outDir, { recursive: true });

const python = process.env.PYTHON || "python";
execFileSync(python, ["-c", "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])", electronZip, electronStage], { stdio: "ignore" });
cpSync(resolve(root, "dist"), join(appStage, "dist"), { recursive: true });
cpSync(resolve(root, "desktop"), join(appStage, "desktop"), { recursive: true });
writeFileSync(join(appStage, "package.json"), JSON.stringify({ name: "pundi", productName: "Pundi", version: "8.8.0", main: "desktop/main.cjs" }, null, 2));
await createPackage(appStage, asarPath);

cpSync(electronStage, outDir, { recursive: true });
const runtimeExe = join(outDir, "electron.exe");
cpSync(runtimeExe, targetExe);
rmSync(runtimeExe, { force: true });
const rcedit = resolve(root, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
if (existsSync(rcedit)) execFileSync(rcedit, [targetExe, "--set-icon", resolve(root, "desktop", "pundi.ico")], { stdio: "ignore" });

const digest = createHash("sha256").update(readFileSync(targetExe)).digest("hex");
const manifest = { status: "PASS", packaging: "electron-runtime-plus-asar", version: "8.8.0", electronVersion, architecture: "x64", executable: targetExe, executableSize: readFileSync(targetExe).byteLength, executableSha256: digest, appArchive: join(outDir, "resources", "app.asar"), icon: resolve(root, "desktop", "pundi.ico"), runtime: "loopback-static-dist" };
writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
rmSync(tempRoot, { recursive: true, force: true });
console.log(JSON.stringify(manifest));
