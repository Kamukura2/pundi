import { nativeCors } from "./_lib/http.js";
import { handleCommerce } from "./_lib/commerce-handler.js";

export default function handler(request, response) {
  const route = request.query?.__commerce_route || new URL(request.url, `https://${request.headers.host || "pundi.online"}`).searchParams.get("__commerce_route");
  if (route === "commerce" || route === "webhook") return handleCommerce(request, response, { webhook: route === "webhook" });
  if (!nativeCors(request, response, ["GET"])) return;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error:"Supabase is not configured." });
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ supabaseUrl, supabaseAnonKey });
}
