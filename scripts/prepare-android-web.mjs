import { copyFile, mkdir, access, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const source = resolve(dist, "app.html");
const target = resolve(dist, "index.html");

await access(source);
const html = await readFile(source, "utf8");
if (!html.includes("<title>") || !html.includes("assets/")) {
  throw new Error("dist/app.html is not a Vite-built Pundi app shell.");
}
await mkdir(dist, { recursive:true });
await copyFile(source, target);
console.log(JSON.stringify({ status:"PASS", source:"dist/app.html", target:"dist/index.html" }));
