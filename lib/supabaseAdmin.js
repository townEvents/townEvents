import { createClient } from "@supabase/supabase-js";

// SUPABASE_SECRET_KEY (no NEXT_PUBLIC_ prefix) — this must never be exposed
// to the browser. It's only read here, in server-side code, and only used
// by the cron job route.
//
// Wrapped in a function (rather than created at module load time) so a
// missing environment variable only breaks the actual cron request, not
// the entire Vercel build.
export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !secretKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY. Check Vercel Settings > Environment Variables."
    );
  }

  return createClient(supabaseUrl, secretKey, { auth: { persistSession: false } });
}

