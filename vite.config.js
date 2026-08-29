import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

const buildId = process.env.PUNDI_BUILD_ID || execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding:"utf8" }).trim();

export default defineConfig({
  define: { __PUNDI_BUILD_ID__: JSON.stringify(buildId) },
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin/index.html"
      }
    }
  }
});
