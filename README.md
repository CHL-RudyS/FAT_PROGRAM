# FAT Program — Modul Akuntansi

Internal accounting system for PT. Cipta Harmoni Lestari, built from the Claude Design
prototype in `design/project/FAT PROGRAM.dc.html`.

- **Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 · PostgreSQL
- **Design source of truth:** `design/project/FAT PROGRAM.dc.html` (37 screens) and the
  design conversation in `design/chats/`
- **Implementation conventions:** `docs/IMPLEMENTATION-GUIDE.md`

## Running locally

Requires Node 20+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # then set DATABASE_URL and SESSION_SECRET
npm run db:push               # create the schema
npm run db:seed               # companies, units, chart of accounts, roles, users
npm run dev
```

Open http://localhost:3000. Sign in with `kartika@kantor.id` / `rahasia123`
(Administrator). The seed also creates accountant, reviewer, director and staff accounts
sharing the same password.

`SESSION_SECRET` signs the session cookie — generate one with `openssl rand -base64 32`.

## Deploying (Vercel + Neon/Postgres)

The build alone does **not** create your database tables, so a fresh deployment
will fail at login until you do this once:

1. Set environment variables in Vercel → Settings → Environment Variables:
   - `DATABASE_URL` — your Postgres connection string (Vercel's Neon integration
     may only set `POSTGRES_URL`; the app falls back to it, but setting
     `DATABASE_URL` explicitly is clearest)
   - `SESSION_SECRET` — `openssl rand -base64 32`
2. Create the schema and seed it, pointing at the production database:
   ```bash
   DATABASE_URL="<production connection string>" npm run db:push
   DATABASE_URL="<production connection string>" npm run db:seed
   ```
3. Redeploy.

**Check a deployment with `GET /api/health`.** It reports, without exposing any
credentials, whether `DATABASE_URL` and `SESSION_SECRET` are set, whether the
database is reachable, whether the tables exist, and whether the seed has run —
and names the fix for whichever step is missing. It returns just `{"ok":true}`
when everything is in order.

## How the app is organised

```
src/app/login              screen 00 — sign in
src/app/setup              screen 01 — Set Up module launcher
src/app/perusahaan         screen 02 — pick company, then business unit
src/app/beranda            screen 03 — module home
src/app/(app)/*            screens 04-37 — module screens, wrapped in the app shell
src/app/api/*              route handlers (auth, context, and one folder per module)
src/components/shell       left rail, header, module bar, icons
src/components/ui          Dialog, PageHead, Metrics, Toast
src/lib                    db, auth, session, active context, api helpers, formatting
src/i18n                   ID→EN dictionary ported from the prototype, locale provider
prisma/schema.prisma       data model for every module
```

Entry screens (00-03) are full-screen, matching the prototype, where each covers the app
shell entirely. Everything under `(app)` renders inside the persistent shell.

## Working in the codebase

- A session carries the **active company and business unit**; module screens and APIs scope
  every query to them via `requireActiveContext()`. Switch context from the header.
- Money is `Decimal(18,2)` in Postgres. Convert with `toNumber()` before passing to client
  components, and format with the helpers in `src/lib/format.ts`.
- Next.js 16 renamed `middleware.ts` to `proxy.ts`; route-handler params are async.
- Prisma 7 requires a driver adapter — always import the client from `@/lib/db`.
- The generated Prisma client lives in `src/generated/prisma` (run `npm run db:generate`
  after changing the schema).

## Language

The interface is Indonesian. `src/i18n/dictionary.ts` carries the English translations
ported from the prototype; wrap user-visible strings in `t()` from `useT()` so the language
toggle on the login screen works.
