// End-to-end check of the Notch data layer.
// Usage:
//   1. Copy .env.example to .env and fill in your Supabase credentials
//   2. Run supabase/schema.sql once in the Supabase SQL editor
//   3. npm run verify:db
//
// Steps: insert test market -> insert test bet -> call
// update_market_odds RPC -> verify realtime fires on bet insert
// -> delete test data.

import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Minimal .env loader (avoids an extra dependency)
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
if (!url || !anonKey || url.includes('your-project')) {
  console.error('Missing Supabase credentials. Copy .env.example to .env first.')
  process.exit(1)
}

const supabase = createClient(url, anonKey, {
  realtime: { params: { eventsPerSecond: 10 } }
})

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

const TEST_QUESTION = `__verify_market_${Date.now()}__`

let marketId = null
let betIds = []

try {
  // 1. Insert a test market
  const { data: market, error: mErr } = await supabase
    .from('markets')
    .insert({
      creator_address: 'NQ07 0000 0000 0000 0000 0000 0000 0000 0000',
      question: TEST_QUESTION,
      side_a_label: 'Yes',
      side_b_label: 'No',
      category: 'crypto',
      type: 'prediction',
      duration_ends_at: new Date(Date.now() + 3600_000).toISOString()
    })
    .select()
    .single()
  check('insert test market', !mErr, mErr?.message ?? market?.id)
  if (mErr) {
    if (mErr.message.includes('schema cache')) {
      console.log('\nHINT: tables are missing — run supabase/schema.sql in the Supabase SQL editor first.')
    }
    process.exit(1)
  }
  marketId = market.id

  // 2. Insert a test bet
  const { data: bet, error: bErr } = await supabase
    .from('bets')
    .insert({
      market_id: marketId,
      bettor_address: 'NQ07 1111 1111 1111 1111 1111 1111 1111 1111',
      side: 'a',
      amount_nim: 10,
      tx_hash: `verify-tx-${Date.now()}`
    })
    .select()
    .single()
  check('insert test bet', !bErr, bErr?.message ?? bet?.id)
  if (bErr) process.exit(1)
  betIds.push(bet.id)

  // 3. Atomic odds update via RPC
  const { error: rpcErr } = await supabase.rpc('update_market_odds', {
    p_market_id: marketId,
    p_side: 'a',
    p_amount: 10
  })
  check('update_market_odds RPC', !rpcErr, rpcErr?.message ?? 'ok')
  const { data: updated } = await supabase
    .from('markets')
    .select('total_nim_a,total_bettors')
    .eq('id', marketId)
    .single()
  check(
    'odds applied atomically',
    Number(updated?.total_nim_a) === 10 && updated?.total_bettors === 1,
    `total_nim_a=${updated?.total_nim_a} total_bettors=${updated?.total_bettors}`
  )

  // 4. Realtime: subscribe, then insert a bet and expect the event
  const realtimeOk = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 15000)
    const channel = supabase
      .channel('verify-bets')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bets', filter: `market_id=eq.${marketId}` },
        () => {
          clearTimeout(timer)
          supabase.removeChannel(channel)
          resolve(true)
        }
      )
      .subscribe()
    // Insert the triggering bet shortly after subscribing
    setTimeout(async () => {
      const { data: b2 } = await supabase
        .from('bets')
        .insert({
          market_id: marketId,
          bettor_address: 'NQ07 2222 2222 2222 2222 2222 2222 2222 2222',
          side: 'b',
          amount_nim: 5,
          tx_hash: `verify-tx-rt-${Date.now()}`
        })
        .select()
        .single()
      if (b2) betIds.push(b2.id)
    }, 2000)
  })
  check('realtime fires on bet insert', realtimeOk, realtimeOk ? 'event received' : 'timed out after 15s')

  // 5. Seed data present?
  const { count } = await supabase
    .from('markets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  check('seed/active markets readable', (count ?? 0) > 0, `${count ?? 0} active markets`)
} finally {
  // Cleanup test data. Client deletes are denied by RLS by design
  // (no delete policies), so remove via the SQL editor if needed:
  //   delete from public.markets where question like '__verify_market\\_%';
  // (bets/payouts cascade automatically.)
  if (marketId) {
    // NOTE: RLS denies client deletes, and PostgREST reports that as
    // success with 0 rows — so check the RETURNING payload, not error.
    const { data: deleted, error } = await supabase
      .from('markets')
      .delete()
      .eq('id', marketId)
      .select('id')
    if (!error && deleted?.length) {
      console.log('PASS  test data cleaned up')
    } else {
      console.log(`NOTE  anon delete removed 0 rows (RLS denies client deletes by design) — run in SQL editor: delete from public.markets where id = '${marketId}';`)
    }
    void betIds
  }
}

console.log(process.exitCode ? '\nVerification FAILED' : '\nVerification PASSED')
