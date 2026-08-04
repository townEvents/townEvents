import { createClient } from "@supabase/supabase-js";

// SUPABASE_SECRET_KEY (no NEXT_PUBLIC_ prefix) — this must never be exposed
// to the browser. It's only read here, in server-side code, and only used
// by the cron job route.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

export const supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false },
});
