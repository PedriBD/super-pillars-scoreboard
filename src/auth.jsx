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

export function signIn(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export function signUp(email, password) {
  return supabase.auth.signUp({ email, password });
}

// Oversætter Supabases fejl til dansk
export function authErrorText(error) {
  const code = error?.code || "";
  const msg = (error?.message || "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "Forkert e-mail eller adgangskode.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "Der findes allerede en bruger med den e-mail. Log ind i stedet.";
  if (code === "weak_password" || msg.includes("password should be")) return "Adgangskoden skal være mindst 6 tegn.";
  if (code === "validation_failed" || msg.includes("invalid format") || msg.includes("email address")) return "Den e-mail ser ikke rigtig ud.";
  if (code === "email_not_confirmed") return "Brugeren er ikke bekræftet endnu.";
  if (code === "over_request_rate_limit" || msg.includes("rate limit")) return "For mange forsøg. Vent lidt og prøv igen.";
  return "Noget gik galt. Prøv igen om lidt.";
}

export function signOut() {
  return supabase.auth.signOut();
}
