# Super Pillars Scoreboard

Live scoreboard-tracker til Fortnite-gamemoden Super Pillars. Statisk side (GitHub Pages) med [Supabase](https://supabase.com) som backend, så alle med spil-koden ser opdateringer i realtid på tværs af enheder.

## Sådan virker det

- Man opretter et nyt spil, hvilket genererer en kort spil-kode (fx `K7QX`) og opdaterer URL'en til `?room=K7QX`.
- Alle der åbner det link, eller indtaster koden manuelt, deler samme spil.
- Man aftaler hvor mange runde-sejre der skal til for at vinde. Hver runde registreres score, eliminations og damage dealt pr. spiller — den med højest score vinder runden (ved lighed afgør eliminations, dernæst damage).
- Første spiller til at nå målet vinder hele opgøret.

## 1. Sæt Supabase op (gratis)

1. Opret et projekt på [supabase.com](https://supabase.com).
2. Gå til **SQL Editor** i projektet og kør:

   ```sql
   create table if not exists games (
     room_code text primary key,
     state jsonb not null,
     updated_at timestamptz not null default now()
   );

   alter table games enable row level security;

   create policy "public read" on games for select using (true);
   create policy "public insert" on games for insert with check (true);
   create policy "public update" on games for update using (true);

   alter publication supabase_realtime add table games;
   ```

   Dette gør tabellen offentligt læs-/skrivbar (uden login), afgrænset i praksis af at spil-koden er tilfældig og ikke deles offentligt. Fint til en scoreboard-app blandt venner — ikke egnet hvis I vil beskytte mod alle der gætter koden.

3. Under **Project Settings → API** finder du:
   - **Project URL**
   - **anon public key**

4. Åbn [`supabase-config.js`](supabase-config.js) og indsæt dem:

   ```js
   const SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   const SUPABASE_ANON_KEY = "din-anon-key";
   ```

   Denne nøgle er beregnet til at ligge i klient-kode — det er Row Level Security-policyerne ovenfor der styrer adgang, ikke hemmeligholdelse af nøglen.

## 2. Kør lokalt

Fordi siden bruger ES modules, skal den serveres over http (ikke åbnes direkte som `file://`). Fra mappen:

```bash
python3 -m http.server 8080
```

Åbn `http://localhost:8080`.

## 3. Deploy til GitHub Pages

1. Push reposet til GitHub (se nedenfor).
2. Gå til **Settings → Pages** i GitHub-reposet.
3. Under **Build and deployment**, vælg **Deploy from a branch**, branch `main`, mappe `/ (root)`.
4. Siden bliver tilgængelig på `https://<bruger>.github.io/<repo>/`.

## Filer

- `index.html` — sidens struktur
- `style.css` — udseende
- `app.js` — spil-logik og Supabase-sync
- `supabase-config.js` — dine Supabase-nøgler (indsæt dine egne, se ovenfor)
