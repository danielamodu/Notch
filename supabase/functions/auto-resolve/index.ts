import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Runs every 5 minutes via pg_cron. Finds expired active opinion markets
// and hands each one to process-payouts (which handles no-bets, ties,
// winners, losers, and marks the market resolved).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: expiredMarkets, error } = await supabase
    .from('markets')
    .select('id')
    .eq('status', 'active')
    .eq('type', 'opinion')
    .lt('duration_ends_at', new Date().toISOString())

  if (error) {
    return json({ error: error.message }, 500)
  }

  if (!expiredMarkets || expiredMarkets.length === 0) {
    return json({ message: 'No expired markets', resolved: 0 })
  }

  const results = []

  for (const market of expiredMarkets) {
    const { data: row } = await supabase.from('markets').select('*').eq('id', market.id).single()
    if (!row) {
      results.push({ id: market.id, error: 'Market not found' })
      continue
    }

    const nimA = Number(row.total_nim_a) || 0
    const nimB = Number(row.total_nim_b) || 0
    const winningSide = nimA >= nimB ? 'a' : 'b'

    try {
      const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ marketId: market.id, winningSide }),
      })

      const data = await response.json()
      results.push({ id: market.id, winningSide, ...data })
    } catch (err: any) {
      results.push({ id: market.id, error: err?.message || String(err) })
    }
  }

  return json({ resolved: results.length, results })
})
