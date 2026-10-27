import { createClient } from "@supabase/supabase-js";

// Begge værdier er offentlige og må gerne ligge i koden.
// Det er adgangsreglerne (Row Level Security) i databasen, der beskytter data.
const SUPABASE_URL = "https://ulunjtgszuuosyofkkfo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdW5qdGdzenV1b3N5b2Zra2ZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzQzMDksImV4cCI6MjEwNzMxMDMwOX0.jJHxn8-mJmJLv5KjGXVbaiQo8zKF-5eZxYdR0vMuuv8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: "pkce" },
});
