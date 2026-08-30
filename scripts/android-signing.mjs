import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const keystoreDir = resolve(root, "android", "keystore");
const keystore = resolve(keystoreDir, "pundi-alpha.jks");
const propertiesFile = resolve(root, "android", "alpha-signing.properties");
const alias = "pundi-alpha";

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

if (await exists(propertiesFile) && await exists(keystore)) {
  const props = await readFile(propertiesFile, "utf8");
  for (const marker of ["storeFile=", "storePassword=", "keyAlias=pundi-alpha", "keyPassword="]) {
    if (!props.includes(marker)) throw new Error("Local Alpha signing properties are incomplete.");
  }
  console.log(JSON.stringify({ status:"PASS", signing:"existing-local-alpha" }));
} else {
  await mkdir(keystoreDir, { recursive:true });
  const password = randomBytes(32).toString("base64url");
  execFileSync("keytool", [
    "-genkeypair", "-noprompt", "-alias", alias, "-keyalg", "RSA", "-keysize", "2048",
    "-validity", "3650", "-keystore", keystore, "-storepass", password, "-keypass", password,
    "-dname", "CN=Pundi Android Alpha,OU=Pundi,O=Pundi,L=Jakarta,ST=Jakarta,C=ID"
  ], { stdio:"ignore", windowsHide:true });
  await writeFile(propertiesFile, [
    "storeFile=keystore/pundi-alpha.jks",
    `storePassword=${password}`,
    `keyAlias=${alias}`,
    `keyPassword=${password}`,
    ""
  ].join("\n"), { encoding:"utf8", mode:0o600 });
  console.log(JSON.stringify({ status:"PASS", signing:"created-local-alpha" }));
}
