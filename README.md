# Chakula Finder

**Smart food search for restaurant menus.** Customers search the way they actually talk, in English, Swahili
or Sheng, and get matching dishes with a one-line reason for each match.

> *"something spicy and filling under 800"* · *"vegetarian lunch, no nuts"* · *"comfort food for a rainy day"* ·
> *"kitu ya kushiba bila nyama"*

## Goal

Menus are hard to search. People don't think in categories; they think "spicy, cheap, no nuts, something for
the kids". The goal of this project is a search that understands that language **without ever being wrong on
the things that matter**: allergies, diet and price.

The approach is a hybrid. AI is used where it's strong (understanding messy language) and kept away from
where it can't be trusted (deciding what is safe to eat):

* **Claude** reads the query and extracts structured filters (price, diet, allergens, spice, mood).
* **Postgres** enforces the strict filters in SQL, so a nut dish can never be returned for "no nuts".
* **Vector search** (pgvector) ranks the remaining dishes for fuzzy ideas like "comfort food" or "light".

It also gives the restaurant owner something useful: a log of what customers search for, including searches
that returned nothing, which shows what people want that isn't on the menu.

## Features

* Search bar with example queries; understands English, Swahili and Sheng
* **Editable filter chips** showing what the AI understood ("Vegetarian · Under KES 800"); tap one to remove it
* **"Why it matches"** line on every result (e.g. "Spicy · Vegetarian · KES 650")
* **Smart no-results:** suggests loosening one preference ("Nothing under KES 500. Here are options under KES 700"), and never suggests dropping an allergen or diet restriction
* Dish page with photo, price, spice level, allergens and an **Order on WhatsApp** button (message pre-filled)
* **Admin page** (`/admin`): sign in, add/edit dishes, upload photos, mark sold out. Sold-out dishes disappear from results; the search index updates when a dish is saved
* **Search insights** (`/admin/insights`): top searches and searches with zero results
* **Fallback search** if the AI is slow or down, so search never breaks

Deliberately left out: payments, delivery tracking, customer accounts, reviews and chatbots.

## Tech stack

| Layer | Technology | Used for |
|---|---|---|
| Framework | **Next.js** (App Router) + React + TypeScript | UI, and a single API route (`/api/search`) that keeps the AI key server-side |
| Database | **Supabase Postgres** | dishes, search log, the SQL search function |
| Vector search | **pgvector** | semantic ranking of dishes |
| Embeddings | Supabase Edge Function running **gte-small** | text to 384-d vectors (free, no extra API key) |
| Auth | **Supabase Auth** + Row Level Security | admin login; public read, admin-only write |
| File storage | **Supabase Storage** bucket `dish-images` | dish photos (the DB stores only the file path) |
| AI | **Claude** via the Anthropic REST API (plain `fetch`, no SDK) | turns a sentence into validated JSON filters |
| Validation | **zod** | rejects malformed AI output |
| Tests | **Vitest** + **PGlite** (in-process Postgres with pgvector) | 21-query evaluation set + safety checks, no external services |
| CI | GitHub Actions | typecheck, tests, build on every push |

## How the search works

```
"vegetarian lunch, no nuts, chini ya 800"
 │
 1. Understand  /api/search → Claude (forced tool call → JSON, validated with zod)
 │              { vegetarian, excludeAllergens:["nuts"], maxPrice:800, tags:[…], semanticQuery:"…" }
 │              A deterministic rule parser runs too, and its allergen/diet findings are always merged in,
 │              so the AI can never drop a "no nuts".
 2. Filter      Postgres function search_dishes(): price, diet, allergens, spice, sold-out  ← HARD, in SQL
 3. Rank        pgvector similarity + tag overlap + keyword hits                             ← SOFT
 4. Explain     "Vegetarian · No nuts · KES 650" built from the matched filters (not LLM-written)
 5. Log         every search saved for the owner's insights
```

**Where AI is and isn't trusted.** Claude only *proposes* filter values. Safety is enforced in SQL. Dishes
whose allergen list hasn't been confirmed by a person (`allergens_verified = false`) are excluded from any
allergen-restricted search.

### Reliability

| Failure | What happens |
|---|---|
| Claude slow (>3 s), down, rate-limited, or returns invalid JSON | Rule-based parser (English + common Swahili/Sheng phrases); UI shows a "basic search" badge |
| Embedding function unavailable | Ranking falls back to tags + keywords; results stay correct |
| Search logging fails | Ignored; the search still returns |
| Someone hammering the endpoint | 20 searches/min/IP (in-memory; use Redis/Upstash for a hard limit in production) |
| User disagrees with the AI | Tap a chip to remove it; this re-runs the search **without** calling the AI |

## Project structure

```
app/                    Next.js pages: search (/), dish detail, admin, insights, and api/search
components/             DishCard
lib/                    claude.ts (AI call) · ruleParse.ts (fallback) · search.ts · relax.ts · why.ts · chips.ts · supabase.ts
supabase/migrations/    001 tables + search function + views · 002 security (RLS) + storage bucket
supabase/seed.sql       30 sample Kenyan dishes
supabase/functions/     embed/ Edge Function (gte-small)
scripts/                embed-all.mjs (backfill vectors) · upload-images.mjs (bulk photo upload)
tests/                  query set, safety invariants, AI-layer tests
```

## Setup and run

**Prerequisites:** Node.js 20+ (22 recommended), a free [Supabase](https://supabase.com) account, and
(optional) an [Anthropic API key](https://console.anthropic.com). Without the key the app runs in basic-search mode.

### 1. Install

```bash
git clone <your-repo-url> chakula-search
cd chakula-search
npm install
```

### 2. Create the database

In your Supabase project open **SQL Editor** and run these files, one at a time, in this order:

1. `supabase/migrations/001_tables_and_search.sql`
2. `supabase/migrations/002_security.sql`
3. `supabase/seed.sql`

Check: **Table Editor → dishes** shows 30 rows and **Storage** shows a `dish-images` bucket.

### 3. Create the admin user

**Authentication → Users → Add user → Create new user** (tick "Auto confirm user"). Then, under
**Authentication → Sign In / Providers**, turn **off** "Allow new users to sign up". Any signed-in user can
edit the menu, so sign-ups must stay closed.

### 4. Configure environment variables

```bash
cp .env.example .env.local        # Windows (cmd): copy .env.example .env.local
```

| Variable | Where to get it | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page (anon or "publishable" key) | public by design; Row Level Security protects the data |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | **secret**, server-only. Optional |
| `ANTHROPIC_MODEL` | | defaults to `claude-haiku-5-5` |
| `SUPABASE_SERVICE_ROLE_KEY` | same Supabase page ("secret"/service_role key) | **secret**. Only for the two scripts in `scripts/`; skip if you don't run them |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | the restaurant's number | country code + number, digits only (`254712345678`). Used by the "Order on WhatsApp" button |

`.env.local` is git-ignored. Never put secret keys in a variable starting with `NEXT_PUBLIC_`; those are
sent to the browser.

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000. Admin is at `/admin`, insights at `/admin/insights`. Restart the dev server
after editing `.env.local`.

### 6. (Recommended) Enable semantic ranking

The Edge Function turns text into vectors. Deploy it from the dashboard (**Edge Functions → Deploy a new
function → Via Editor**, name it `embed`, paste `supabase/functions/embed/index.ts`) or with the CLI:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy embed
```

Then fill in vectors for the seeded dishes (needs `SUPABASE_SERVICE_ROLE_KEY`):

```bash
npm run embed:all
```

Dishes you add or edit in `/admin` are embedded automatically on save.

### Photos

Add a photo when creating or editing a dish in `/admin`, or in bulk: put files named after the dish slug
(e.g. `images/ugali-sukuma.jpg`) in `images/` and run `npm run seed:images`. Photos are stored in the
`dish-images` bucket; the database stores only the file path, and the app builds the public URL from it.

### Using your own menu

Replace `supabase/seed.sql` with your dishes (or import a CSV in the Table Editor). Fill in `spice_level`,
`allergens` and `tags` for every dish, and set `allergens_verified = true` **only after a person has checked
the allergens**. The bundled menu is invented sample data.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | start the dev server |
| `npm run build` / `npm start` | production build / serve it |
| `npm test` | run the test suite |
| `npm run typecheck` | TypeScript check |
| `npm run embed:all` | generate embeddings for dishes that have none |
| `npm run seed:images` | bulk-upload photos from `images/` |

## Tests

```bash
npm test
```

* **21-query evaluation set** (`tests/queries.ts`): English, Swahili and Sheng queries, each with dishes that
  must and must never appear, plus rules like "every result is vegetarian and at most KES 800".
* **Safety invariants:** for *every* allergen, excluding it never returns a dish containing it; unverified
  allergen data is excluded; sold-out dishes never appear.
* **AI layer with mocked HTTP:** the forced tool call is sent; timeouts, HTTP errors and invalid JSON fall back;
  an AI answer that drops "no nuts" is overridden.
* Runs against **real Postgres + pgvector** (PGlite) using the exact migrations and seed from this repo, so
  it needs no Supabase project or API key and runs in GitHub Actions (`.github/workflows/ci.yml`).

Not covered by CI: the live Claude response and the live embedding model (non-deterministic and need keys).
After deploying, smoke-test a few Swahili/Sheng queries by hand.

## Deploying

Works on Vercel or any Node host. Set the same environment variables from step 4 in the host's dashboard
(without the `.env.local` file). Keep `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as server-side secrets.

## Security notes

* Secrets live only in `.env.local` / your host's environment settings; `.gitignore` excludes every `.env*` file except `.env.example` (placeholders only).
* The publishable/anon key is meant to be public. What it can do is limited by Row Level Security: the public can read dishes and log searches; only a signed-in admin can edit dishes, upload photos or read the search log.
* The Claude key is only ever used inside `/api/search`, never in the browser.
* If a secret key is ever committed or shared, rotate it in its dashboard right away.

## Known limits

* `gte-small` is English-only, so Claude translates Swahili/Sheng into an English `semanticQuery` first. In
  fallback mode only the built-in Swahili/Sheng phrases in `lib/ruleParse.ts` are understood.
* The in-memory rate limiter is per server instance.
* Allergen data is only as good as the people entering it. Always have a person verify it.
