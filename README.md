# Notch — Social Conviction Markets

**Put your conviction on the line.** Notch is a mobile-first mini app running inside [Nimiq Pay](https://nimpay.app), where anyone can create a question, pick a side, and back it with NIM. Opinion markets settle by crowd stake, prediction markets settle by creator resolution — winners get paid automatically, on-chain.

Built for the **Nimiq Mini Apps Competition** (Cycle II). Live at [notchlabs.vercel.app](https://notchlabs.vercel.app) — open it from Nimiq Pay → Mini Apps → Custom URL.

## How it works

- **Feed** — live markets with conviction splits, pools, bettor counts and countdowns. Sorts by trending, newest and closing soon. Odds animate in realtime; pull to refresh.
- **Create** — ask a question, pick a category, type and duration. Costs **0.1 NIM**, sent on-chain as proof of creation (`notch:create:<id>` memo), then the market is stored with its tx hash.
- **Bet** — tap a side, enter any amount (min 0.1 NIM), confirm in Nimiq Pay. Potential payout previews live: `(bet / (side + bet)) × (pool + bet) × 0.95`.
- **Resolve** — opinion markets auto-resolve when they expire (majority NIM wins); prediction markets are resolved by their creator. Winners split the pool minus a **5% house cut**, paid straight to their wallets. **Ties refund every stake in full** — nobody loses on a draw.
- **Portfolio** — positions, created markets, win rate and NIM won, computed from real on-chain-backed data. Shareable result cards included.

## Tech stack

- **Frontend** — React 19 + TypeScript + Vite, Tailwind CSS v4, single-screen state-machine UI (no router; deep links land on the feed)
- **Wallet** — [`@nimiq/mini-app-sdk`](https://www.npmjs.com/package/@nimiq/mini-app-sdk) (`init()`, `listAccounts`, `sendBasicTransactionWithData`)
- **Data** — Supabase Postgres + Realtime (`markets`, `bets`, `profiles`, `payouts`; see `supabase/schema.sql`)
- **Payouts** — Supabase Edge Functions (Deno) that sign with the house key and broadcast via Nimiq JSON-RPC, triggered manually on resolve or every 5 minutes by `pg_cron` for expired opinion markets

## Getting started

```bash
npm install
npm run dev        # LAN-reachable; open the Network URL in Nimiq Pay → Mini Apps
npm run build      # production build into dist/
```

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + local `.env` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel + local `.env` | Supabase anon key |
| `VITE_HOUSE_WALLET_ADDRESS` | Vercel + local `.env` | Receives creation fees; pays out winnings |

### Edge functions (payouts)

```bash
npm i -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy process-payouts
supabase functions deploy auto-resolve
```

Secrets (dashboard → Project Settings → Edge Functions, or `supabase secrets set`):

| Secret | Purpose |
|---|---|
| `HOUSE_WALLET_ADDRESS` | Must match the key below — verified on every run |
| `HOUSE_SEED_PHRASE` | 12-word house recovery phrase (or `HOUSE_WALLET_PRIVATE_KEY` hex instead) |
| `NIMIQ_RPC_URL` | Optional — defaults to `https://rpc.nimiqwatch.com` |
| `NIMIQ_NETWORK` | Optional — `main` (default) or `test` |
| `NIMIQ_DERIVATION_PATH` | Optional — defaults to `m/44'/242'/0'/0/0` |

Auto-resolve every 5 minutes (SQL editor, with `pg_cron` + `pg_net` enabled):

```sql
SELECT cron.schedule('auto-resolve-markets','*/5 * * * *',$$
SELECT net.http_post(url:='https://YOUR_PROJECT_REF.supabase.co/functions/v1/auto-resolve',
headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer YOUR_SERVICE_ROLE_KEY'),body:='{}'::jsonb);$$);
```

## Project structure

```
src/
  Home.tsx              # all screens: feed, detail, create, profile, sheets
  main.tsx              # entry, fatal-error popup, wallet gate
  index.css             # editorial design system (Hot Red / Soft Beige)
  components/NotchLogo.tsx
  nimiq/NimiqContext.tsx# wallet provider, transactions, debug overlay
  lib/db.ts             # Supabase queries  ·  lib/supabase.ts  # client
  utils/markets.ts      # odds, countdowns, payouts, formatting
supabase/
  schema.sql            # tables, RLS, RPC, realtime, seed markets
  functions/            # process-payouts, auto-resolve, shared signer
```

## License

MIT — see [LICENSE](./LICENSE).
