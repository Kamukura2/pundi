import { createClient } from "@supabase/supabase-js";
import { cacheGet, cachePut } from "./idb.js";
import { apiUrl } from "./runtime.js";

let clientPromise;

function builtPublicConfig() {
  const supabaseUrl = typeof __PUNDI_SUPABASE_URL__ === "string" ? __PUNDI_SUPABASE_URL__.trim() : "";
  const supabaseAnonKey = typeof __PUNDI_SUPABASE_ANON_KEY__ === "string" ? __PUNDI_SUPABASE_ANON_KEY__.trim() : "";
  return supabaseUrl && supabaseAnonKey ? { supabaseUrl, supabaseAnonKey } : null;
}

async function loadPublicConfig() {
  const built = builtPublicConfig();
  if (built) return built;
  try {
    const response = await fetch(apiUrl("/api/config"), { cache: "no-store" });
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

export async function getAuthenticatedSession({ refresh = true } = {}) {
  const supabase = await getSupabase();
  let { data:{ session }, error } = await supabase.auth.getSession();
  if (!session?.access_token && refresh) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data?.session || null;
    error = refreshed.error || error;
  }
  return { supabase, session, error };
}
