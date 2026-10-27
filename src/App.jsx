import { HashRouter, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { signOut, useAuth } from "./auth.jsx";
import Avatar from "./components/Avatar.jsx";
import Login from "./pages/Login.jsx";
import JoinGroup from "./pages/JoinGroup.jsx";
import ChoosePlayer from "./pages/ChoosePlayer.jsx";
import Players from "./pages/Players.jsx";
import Sessions from "./pages/Sessions.jsx";
import Session from "./pages/Session.jsx";
import GlobalStats from "./pages/GlobalStats.jsx";
import Profile from "./pages/Profile.jsx";

export default function App() {
  const { session, isMember, myPlayer, error } = useAuth();

  if (error) return <Shell><p className="gate-error">{error}</p></Shell>;
  if (session === undefined) return <Shell><Loading /></Shell>;
  if (!session) return <Shell><Login /></Shell>;
  if (isMember === undefined || myPlayer === undefined) return <Shell><Loading /></Shell>;
  if (!isMember) return <Shell><JoinGroup /></Shell>;
  if (!myPlayer) return <Shell><ChoosePlayer /></Shell>;

  return (
    <HashRouter>
      <Shell nav>
        <Routes>
          <Route path="/" element={<Sessions />} />
          <Route path="/opgor/:id" element={<Session />} />
          <Route path="/opgor/:id/statistik" element={<Session />} />
          <Route path="/statistik" element={<GlobalStats />} />
          <Route path="/spillere" element={<Players />} />
          <Route path="/spiller/:id" element={<Profile />} />
        </Routes>
      </Shell>
    </HashRouter>
  );
}

function Shell({ nav, children }) {
  const { myPlayer, session } = useAuth();
  return (
    <div className="wrap">
      <header className="masthead">
        <div>
          <p className="masthead-title">Super Pillars</p>
          <p className="masthead-sub">Scoreboard</p>
        </div>
        {session && (
          <div className="masthead-status">
            {myPlayer && (
              <span className="me-chip">
                <Avatar player={myPlayer} size={28} />
                <span>{myPlayer.name}</span>
              </span>
            )}
            <button type="button" className="btn-ghost" onClick={signOut}>Log ud</button>
          </div>
        )}
      </header>
      {nav && <Nav myPlayerId={myPlayer.id} />}
      {children}
    </div>
  );
}

function Nav({ myPlayerId }) {
  const { pathname } = useLocation();
  const playerPage = pathname.startsWith("/spiller/") && pathname !== "/spiller/" + myPlayerId;
  return (
    <nav className="tabs">
      <NavLink to="/" className={"tab" + (pathname === "/" || pathname.startsWith("/opgor") ? " active" : "")}>Opgør</NavLink>
      <NavLink to="/statistik" className="tab">Statistik</NavLink>
      <NavLink to="/spillere" className={"tab" + (pathname === "/spillere" || playerPage ? " active" : "")}>Spillere</NavLink>
      <NavLink to={"/spiller/" + myPlayerId} className="tab">Min profil</NavLink>
    </nav>
  );
}

function Loading() {
  return <p className="panel-hint loading">Indlæser…</p>;
}
