import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Paste your Supabase project's values here (Project settings > API).
// The anon key is safe to expose in client-side code — Row Level Security
// policies on the "games" table are what actually control access.
const SUPABASE_URL = "https://ulunjtgszuuosyofkkfo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdW5qdGdzenV1b3N5b2Zra2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzQzMDksImV4cCI6MjEwNzMxMDMwOX0.jJHxn8-mJmJLv5KjGXVbaiQo8zKF-5eZxYdR0vMuuv8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
