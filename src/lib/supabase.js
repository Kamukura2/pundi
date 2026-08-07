import { createClient } from "@supabase/supabase-js";
import { cacheGet, cachePut } from "./idb.js";

let clientPromise;

async function loadPublicConfig() {
  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (!response.ok) throw new Error("Supabase public configuration is unavailable.");
    const config = await response.json();
    await cachePut("public-config", config);
    return config;
  } catch (error) {
    const cached = await cacheGet("public-config");
    if (cached) return cached;
    throw error;
  }
}

export function getSupabase() {
  if (!clientPromise) {
    clientPromise = loadPublicConfig().then(({ supabaseUrl, supabaseAnonKey }) => {
      if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase environment variables are missing.");
      return createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        realtime: { params: { eventsPerSecond: 5 } }
      });
    });
  }
  return clientPromise;
}
