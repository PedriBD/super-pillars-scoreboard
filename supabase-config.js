import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paste your Supabase project's values here (Project settings > API).
// The anon key is safe to expose in client-side code — Row Level Security
// policies on the "games" table are what actually control access.
const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_ANON_KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
