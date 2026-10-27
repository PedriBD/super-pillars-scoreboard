# Super Pillars Scoreboard

Scoreboard til Fortnite-gamemoden Super Pillars. Version 2 er en React-app (Vite) med Google-login og Supabase som database.

> Version 2 er under opbygning på branchen `v2`. Den gamle side (branch `main`) kører videre på GitHub Pages, indtil v2 er klar.

## Sådan virker det

- Man logger ind med Google. Første gang skal man indtaste gruppekoden, så fremmede ikke kan se eller ændre data.
- Derefter vælger man, hvilken af de eksisterende spillere man er, eller opretter sig som ny spiller.
- Alle spillere findes på én fælles liste på tværs af opgør. Man kan ændre navn og profilbillede på sig selv og på gæster (spillere uden bruger).
- Har man spillet under to navne, kan man lægge en gæst sammen med sin egen profil ("Det er også mig").

## Kør lokalt

```bash
npm install
npm run dev
```

Åbn http://localhost:5173.

## Opsætning af Supabase

1. Kør [`supabase/migrations/001_v2_schema.sql`](supabase/migrations/001_v2_schema.sql) i SQL Editor. Den opretter tabeller, adgangsregler og lager til profilbilleder.
2. Kør `select import_legacy_games();` for at kopiere opgør, spillere og kampe fra den gamle side. Den kan køres igen senere og springer allerede importerede kampe over.
3. Gruppekoden er den samme som adgangskoden til den gamle side (tabellen `site_gate`).

## Opsætning af Google-login

1. Gå til [Google Cloud Console](https://console.cloud.google.com/apis/credentials), opret et projekt og et **OAuth client ID** af typen **Web application**.
2. Under **Authorized redirect URIs** tilføjes: `https://ulunjtgszuuosyofkkfo.supabase.co/auth/v1/callback`
3. I Supabase: **Authentication → Sign In / Providers → Google**. Slå den til og indsæt Client ID og Client Secret.
4. I Supabase: **Authentication → URL Configuration**. Sæt **Site URL** til appens adresse, og tilføj `http://localhost:5173/**` og appens adresse under **Redirect URLs**.

## Deploy

`npm run build` laver en statisk side i `dist/`, som kan lægges på Vercel eller GitHub Pages.

## Filer

- `src/App.jsx`: hvilken side der vises (login, gruppekode, vælg spiller eller selve appen)
- `src/auth.jsx`: login og den indloggede brugers spiller
- `src/pages/`: de enkelte sider
- `src/styles.css`: designet
- `supabase/migrations/`: databasens opbygning
