import { useEffect } from "react";
import { HashRouter, Link, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./auth.jsx";
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
      <ScrollToTop />
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
  return (
    <div className={"wrap" + (nav ? " has-nav" : "")}>
      <div className="statusbar-bg" aria-hidden="true"></div>
      {nav ? (
        <AppHeader />
      ) : (
        <header className="masthead">
          <div>
            <p className="masthead-title">Super Pillars</p>
            <p className="masthead-sub">Scoreboard</p>
          </div>
        </header>
      )}
      {nav && <Nav variant="top" />}
      {children}
      {nav && <Nav variant="bottom" />}
    </div>
  );
}

// Topbjælken inde i appen. På iPhone er den kompakt og bliver stående øverst.
function AppHeader() {
  const { myPlayer } = useAuth();
  return (
    <header className="masthead app-header">
      <div>
        <p className="masthead-title">Super Pillars</p>
        <p className="masthead-sub">Scoreboard</p>
      </div>
      <Link to={"/spiller/" + myPlayer.id} className="me-chip" aria-label="Min profil">
        <Avatar player={myPlayer} size={34} />
        <span className="me-name">{myPlayer.name}</span>
      </Link>
    </header>
  );
}

const TABS = [
  { key: "opgor", label: "Opgør", icon: "M7 4h10v3a5 5 0 0 1-10 0V4Zm-3 1h3v2a2 2 0 0 1-3 0V5Zm13 0h3v2a2 2 0 0 1-3 0V5ZM10 13h4v3h3v3H7v-3h3v-3Z" },
  { key: "statistik", label: "Statistik", icon: "M4 20V10h4v10H4Zm6 0V4h4v16h-4Zm6 0v-7h4v7h-4Z" },
  { key: "spillere", label: "Spillere", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6H2Zm15.5 0c0-2-.8-3.8-2.1-5.1.5-.1 1-.1 1.6-.1 3.3 0 5 2.2 5 5.2h-4.5Z" },
  { key: "profil", label: "Profil", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 8c0-3.9 3.6-6 8-6s8 2.1 8 6H4Z" },
];

// Fanerne: øverst på computer, som menubar i bunden på iPhone.
function Nav({ variant }) {
  const { myPlayer } = useAuth();
  const { pathname } = useLocation();
  const myProfile = "/spiller/" + myPlayer.id;
  const paths = { opgor: "/", statistik: "/statistik", spillere: "/spillere", profil: myProfile };
  const active =
    pathname === myProfile ? "profil"
    : pathname.startsWith("/spiller") ? "spillere"
    : pathname.startsWith("/statistik") ? "statistik"
    : "opgor";

  if (variant === "top") {
    return (
      <nav className="tabs top-nav">
        {TABS.map((t) => (
          <Link key={t.key} to={paths[t.key]} className={"tab" + (active === t.key ? " active" : "")}>
            {t.key === "profil" ? "Min profil" : t.label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => (
        <Link
          key={t.key}
          to={paths[t.key]}
          className={"bottom-tab" + (active === t.key ? " active" : "")}
          aria-current={active === t.key ? "page" : undefined}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            <path d={t.icon} fill="currentColor" />
          </svg>
          <span>{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// Start øverst på siden, når man skifter fane, ligesom i en app
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Loading() {
  return <p className="panel-hint loading">Indlæser…</p>;
}
