import { useState } from "react";
import { authErrorText, signIn, signUp } from "../auth.jsx";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" eller "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    const { data, error } =
      mode === "login" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (error) {
      console.warn("Login fejlede:", error);
      setError(authErrorText(error));
    } else if (mode === "signup" && !data.session) {
      // Sker kun, hvis "Confirm email" stadig er slået til i Supabase
      setError("Brugeren er oprettet, men skal bekræftes via mail, før du kan logge ind. Kontakt den, der står for siden.");
    }
    // Ved succes skifter appen selv videre, fordi login-tilstanden ændrer sig
  }

  function switchMode(next) {
    setMode(next);
    setError(null);
  }

  return (
    <section className="panel">
      <div className="gate-welcome">
        <img className="gate-photo" src="host.jpg" alt="Kroght21" width="120" height="120" />
        <div>
          <p className="gate-welcome-text">Velkommen til Super Pillars!</p>
          <p className="gate-welcome-sub">Log ind eller opret en bruger for at komme i gang.</p>
        </div>
      </div>

      <div className="tabs login-tabs">
        <button type="button" className={"tab" + (mode === "login" ? " active" : "")} onClick={() => switchMode("login")}>
          Log ind
        </button>
        <button type="button" className={"tab" + (mode === "signup" ? " active" : "")} onClick={() => switchMode("signup")}>
          Opret bruger
        </button>
      </div>

      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          autoComplete="email"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "signup" ? "Vælg en adgangskode (mindst 6 tegn)" : "Adgangskode"}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          minLength={mode === "signup" ? 6 : undefined}
          required
        />
        <button type="submit" className="btn-primary btn-login" disabled={busy}>
          {mode === "login" ? "Log ind" : "Opret bruger"}
        </button>
      </form>
      {error && <p className="gate-error">{error}</p>}
      {mode === "login" && (
        <p className="panel-hint login-forgot">Glemt din adgangskode? Kontakt den, der står for siden, så nulstiller de den.</p>
      )}
    </section>
  );
}
