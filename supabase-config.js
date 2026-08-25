import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paste your Supabase project's values here (Project settings > API).
// The anon key is safe to expose in client-side code — Row Level Security
// policies on the "games" table are what actually control access.
const SUPABASE_URL = "https://huqpwlwguakrcqntarhg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_fv9mvApw-aifHRrI7cXwvg_H2B-Bb3o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
