import { defineConfig } from "vite";
import { execFileSync } from "node:child_process";

const buildId = process.env.PUNDI_BUILD_ID || process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7) || (() => {
  try { return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding:"utf8" }).trim(); }
  catch { return "local"; }
})();
const publicSupabaseUrl = process.env.VITE_SUPABASE_URL || process.env.PUNDI_SUPABASE_URL || process.env.SUPABASE_URL || "";
const publicSupabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.PUNDI_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export default defineConfig({
  define: {
    __PUNDI_BUILD_ID__: JSON.stringify(buildId),
    __PUNDI_SUPABASE_URL__: JSON.stringify(publicSupabaseUrl),
    __PUNDI_SUPABASE_ANON_KEY__: JSON.stringify(publicSupabaseAnonKey)
  },
  build: {
    rollupOptions: {
      input: {
        main: "app.html",
        landing: "landing.html",
        privacy: "privacy.html",
        terms: "terms.html",
        support: "support.html",
        updates: "updates.html",
        catatan: "catatan-keuangan.html",
        pengeluaran: "pencatat-pengeluaran.html",
        budgeting: "budgeting.html",
        aset: "aset-investasi.html",
        networth: "net-worth.html",
        tradingJournal: "trading-journal.html",
        backup: "backup-keuangan.html",
        calculator: "kalkulator-net-worth.html",
        admin: "admin/index.html"
      }
    }
  }
});
