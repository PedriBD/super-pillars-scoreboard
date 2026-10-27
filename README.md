# Super Pillars Scoreboard

Scoreboard til Fortnite-gamemoden Super Pillars. Version 2 er en React-app (Vite) med login (e-mail og adgangskode) og Supabase som database.

> Version 2 er under opbygning på branchen `v2`. Den gamle side (branch `main`) kører videre på GitHub Pages, indtil v2 er klar.

## Sådan virker det

- Man opretter en bruger med e-mail og adgangskode. Første gang skal man indtaste gruppekoden, så fremmede ikke kan se eller ændre data.
- Derefter vælger man, hvilken af de eksisterende spillere man er, eller opretter sig som ny spiller.
- Alle spillere findes på én fælles liste på tværs af opgør. Man kan ændre navn og profilbillede på sig selv og på gæster (spillere uden bruger).
- Er den samme person oprettet to gange, lægges de sammen i SQL Editor med `select merge_players(<id der beholdes>, <id der fjernes>);`.

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

## Opsætning af login

1. I Supabase: **Authentication → Sign In / Providers → Email**. Sørg for, at Email er slået til, og slå **Confirm email** fra. Supabase kan ikke sende bekræftelsesmails til ukendte adresser uden en mailtjeneste, så ellers kan nye brugere ikke logge ind.
2. "Glemt adgangskode" virker af samme grund ikke. En adgangskode kan nulstilles i Supabase under **Authentication → Users** eller med SQL:

   ```sql
   update auth.users set encrypted_password = crypt('ny-kode', gen_salt('bf'))
   where email = 'ven@eksempel.dk';
   ```

## Deploy

`npm run build` laver en statisk side i `dist/`, som kan lægges på Vercel eller GitHub Pages.

## Filer

- `src/App.jsx`: hvilken side der vises (login, gruppekode, vælg spiller eller selve appen)
- `src/auth.jsx`: login og den indloggede brugers spiller
- `src/pages/`: de enkelte sider
- `src/styles.css`: designet
- `supabase/migrations/`: databasens opbygning
