import { useState } from "react";
import { signInWithGoogle } from "../auth.jsx";

export default function Login() {
  const [error, setError] = useState(null);

  async function handleLogin() {
    setError(null);
    const { error } = await signInWithGoogle();
    if (error) {
      console.warn("Login fejlede:", error);
      setError("Kunne ikke starte login med Google. Prøv igen.");
    }
  }

  return (
    <section className="panel">
      <div className="gate-welcome">
        <img className="gate-photo" src="host.jpg" alt="Kroght21" width="120" height="120" />
        <div>
          <p className="gate-welcome-text">Velkommen til Super Pillars!</p>
          <p className="gate-welcome-sub">Log ind for at komme i gang.</p>
        </div>
      </div>
      <button type="button" className="btn-primary btn-google" onClick={handleLogin}>
        Log ind med Google
      </button>
      {error && <p className="gate-error">{error}</p>}
    </section>
  );
}
