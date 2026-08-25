# Super Pillars Scoreboard

Scoreboard-tracker til Fortnite-gamemoden Super Pillars. Statisk side (GitHub Pages) med [Supabase](https://supabase.com) som backend, så alle med spil-koden ser opdateringer i realtid på tværs af enheder.

## Sådan virker det

- Hele siden er låst bag en fælles adgangskode (`DanskeMestre2026`). Adgangskoden tjekkes serverside i Supabase og huskes i browseren, så man kun skal indtaste den én gang pr. enhed.
- Man opretter et nyt opgør, hvilket genererer en kort spil-kode (fx `K7QX`) og opdaterer URL'en til `?room=K7QX`.
- Alle der åbner det link, eller indtaster koden manuelt, deler samme opgør — og kan tilføje spillere til rosteret løbende.
- I spiller en hel kamp i Fortnite selv (fx til en har vundet 15 runder), og først når kampen er helt slut, indtaster I slutresultatet: runde-sejre, samlet score, eliminations og damage dealt pr. spiller. Der er ingen løbende runde-for-runde-indtastning undervejs.
- Vinderen af kampen er den med flest runde-sejre (ved lighed afgør samlet score).
- Hver registreret kamp gemmes i kamp-historikken, og "All-time stilling" viser den samlede stilling — flest kampe vundet, flest runde-sejre, mest score osv. — på tværs af alle kampe I nogensinde har spillet i det opgør.

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

3. Kør derefter dette for adgangskode-beskyttelsen af selve siden (kør det i samme SQL Editor):

   ```sql
   create extension if not exists pgcrypto;

   create table if not exists site_gate (
     id int primary key default 1,
     password_hash text not null,
     check (id = 1)
   );

   insert into site_gate (id, password_hash)
   values (1, crypt('DanskeMestre2026', gen_salt('bf')))
   on conflict (id) do update set password_hash = excluded.password_hash;

   alter table site_gate enable row level security;
   -- Ingen policies tilføjes med vilje: tabellen er dermed helt utilgængelig
   -- direkte for klienter, selv med RLS slået til. Kun funktionen herunder
   -- (som kører med forhøjede rettigheder) kan læse den.

   create or replace function check_site_password(pwd text)
   returns boolean
   language sql
   security definer
   set search_path = public, extensions
   as $$
     select exists (
       select 1 from site_gate where id = 1 and password_hash = crypt(pwd, password_hash)
     );
   $$;

   revoke all on function check_site_password(text) from public;
   grant execute on function check_site_password(text) to anon, authenticated;
   ```

   Adgangskoden gemmes kun som et bcrypt-hash i databasen og bliver aldrig sendt til browseren — siden sender det indtastede ord til en Postgres-funktion, som svarer sandt/falsk. Vil du skifte adgangskode senere, kør blot `insert ... on conflict` linjen igen med en ny værdi.

   Hvis `pgcrypto` fejler med en rettighedsfejl, så slå den til under **Database → Extensions** i Supabase-dashboardet i stedet, og kør resten af blokken igen.

4. Under **Project Settings → API** finder du:
   - **Project URL**
   - **anon public key**

5. Åbn [`supabase-config.js`](supabase-config.js) og indsæt dem:

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
