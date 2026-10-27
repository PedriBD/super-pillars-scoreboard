import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

const AuthContext = createContext(null);

// Holder styr på login, medlemskab af gruppen og brugerens egen spiller.
// undefined betyder "henter stadig", null betyder "findes ikke".
export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [isMember, setIsMember] = useState(undefined);
  const [myPlayer, setMyPlayer] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id;

  const refresh = useCallback(async () => {
    if (!userId) {
      setIsMember(undefined);
      setMyPlayer(undefined);
      return;
    }
    setError(null);
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) {
      console.warn("Kunne ikke tjekke medlemskab:", memberError);
      setError("Kunne ikke kontakte databasen. Prøv igen om lidt.");
      return;
    }
    setIsMember(!!member);
    if (!member) {
      setMyPlayer(null);
      return;
    }
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (playerError) {
      console.warn("Kunne ikke hente din spiller:", playerError);
      setError("Kunne ikke hente din profil. Prøv igen om lidt.");
      return;
    }
    setMyPlayer(player || null);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = { session, user: session?.user ?? null, isMember, myPlayer, error, refresh };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
