# Metagame Notes

Collaborative player notes app for the Metagame team — voice-first note taking during poker sessions.

See [PRD.md](./PRD.md) for the full product spec.

---

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS 4** + shadcn/ui + Lucide icons
- **Zustand** for global state
- **Supabase** (Postgres, Auth, Storage, Realtime) for the backend
- **Vercel** for hosting

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+ (Node 24 recommended)
- [pnpm](https://pnpm.io/installation) 10+
- A [Supabase](https://supabase.com/) project
- A [Vercel](https://vercel.com/) account (for deployment)
- Git and GitHub CLI (`gh`) if you plan to push / deploy

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/metagame-luizpedro/metagame-notes.git
cd metagame-notes
pnpm install
```

### 2. Configure environment variables

Copy the template and fill in your Supabase project credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with values from your Supabase project settings
(**Project Settings → API**):

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` secret key (server-only — never commit) |

`.env.local` is gitignored. Never commit it.

### 3. Apply the database schema

Open the Supabase dashboard → **SQL Editor** → **New query**, paste the contents
of [`supabase/migrations/0001_initial_schema.sql`](./supabase/migrations/0001_initial_schema.sql),
and run it. This creates all 7 tables, indexes, RLS policies, and the auto
user-mirror trigger.

### 4. Configure Auth URLs

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (for dev) or your production URL
- **Redirect URLs**: add both `http://localhost:3000/**` and your production URL with `/**`

Optionally, in **Authentication → Providers → Email**, disable *Confirm email*
while developing so signups are immediate.

### 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format all files with Prettier |
| `pnpm format:check` | Check formatting without writing |

---

## Deploying

The project deploys to Vercel. After linking via `vercel link`:

1. Add the three environment variables from `.env.local` in **Project Settings → Environment Variables** (Production + Preview).
2. Connect the GitHub repo in **Project Settings → Git** for auto-deploys on push to `main`.
3. Run `vercel --prod` for the first manual deploy.
4. Add the production URL to the Supabase **Site URL** and **Redirect URLs** (see step 4 above).

---

## Project structure

```
src/
  app/
    (auth)/           — login & signup pages, server actions
    auth/signout/     — logout route handler
    dashboard/        — authenticated landing page
    layout.tsx        — root layout with Toaster
    page.tsx          — redirects based on auth state
  components/ui/      — shadcn/ui components
  lib/
    supabase/
      client.ts       — browser Supabase client
      server.ts       — server-side Supabase client
      middleware.ts   — session-refresh helper used by proxy.ts
    utils.ts          — shadcn cn() helper
  proxy.ts            — Next.js 16 proxy (was middleware.ts) — auth gating
supabase/
  migrations/         — versioned SQL migrations
```

---

## Credits

Contributed by Luiz Pedro Andrade to the Metagame team. See [PRD.md §11](./PRD.md) for the ownership and handover model.
