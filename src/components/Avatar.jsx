// Profilbillede, eller forbogstaver på en farvet baggrund, hvis der ikke er et billede.
const COLORS = ["#c26bff", "#3fb6ff", "#ffb23a", "#ff7b5c", "#4fd68a", "#ff5ca8"];

function colorFor(name) {
  let hash = 0;
  for (const ch of name || "") hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COLORS[Math.abs(hash) % COLORS.length];
}

function initials(name) {
  const words = (name || "?").replace(/["']/g, "").trim().split(/\s+/);
  return ((words[0]?.[0] || "?") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

export default function Avatar({ player, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (player?.avatar_url) {
    // no-referrer er nødvendigt for Googles profilbilleder
    return <img className="avatar" src={player.avatar_url} alt="" style={style} referrerPolicy="no-referrer" />;
  }
  return (
    <span className="avatar avatar-initials" style={{ ...style, background: colorFor(player?.name) }} aria-hidden="true">
      {initials(player?.name)}
    </span>
  );
}
