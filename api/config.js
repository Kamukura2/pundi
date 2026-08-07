export default function handler(_request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response.status(503).json({ error:"Supabase is not configured." });
  response.setHeader("Cache-Control", "no-store");
  return response.status(200).json({ supabaseUrl, supabaseAnonKey });
}
