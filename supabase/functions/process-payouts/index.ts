import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendNimiqTransaction } from '../_shared/nimiqSigner.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { marketId, winningSide } = await req.json()

    if (!marketId || !winningSide) {
      throw new Error('marketId and winningSide required')
    }
    if (!['a', 'b'].includes(winningSide)) {
      throw new Error("winningSide must be 'a' or 'b'")
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const houseAddress = Deno.env.get('HOUSE_WALLET_ADDRESS')!
    const housePrivateKey = Deno.env.get('HOUSE_WALLET_PRIVATE_KEY')!
    if (!houseAddress || !housePrivateKey) {
      throw new Error('House wallet secrets are not configured')
    }

    // 1. Fetch and validate market — must still be active.
    const { data: market, error: marketError } = await supabase
      .from('markets')
      .select('*')
      .eq('id', marketId)
      .single()

    if (marketError || !market) {
      throw new Error('Market not found')
    }
    if (market.status === 'resolved') {
      throw new Error('Market already resolved')
    }
    if (market.status !== 'active') {
      throw new Error(`Market is ${market.status}, cannot resolve`)
    }

    // 2. Claim the market (prevents double execution from concurrent calls).
    const { data: claimed } = await supabase
      .from('markets')
      .update({ status: 'resolving' })
      .eq('id', marketId)
      .eq('status', 'active')
      .select('id')

    if (!claimed || claimed.length === 0) {
      throw new Error('Market is already being processed')
    }

    // 3. Fetch all confirmed bets.
    const { data: allBets } = await supabase
      .from('bets')
      .select('*')
      .eq('market_id', marketId)
      .eq('status', 'confirmed')

    const bets = allBets || []
    const totalNimA = Number(market.total_nim_a) || 0
    const totalNimB = Number(market.total_nim_b) || 0

    // 4a. No bets at all — resolve with no winner.
    if (bets.length === 0 || (totalNimA === 0 && totalNimB === 0)) {
      await supabase
        .from('markets')
        .update({ status: 'resolved', winning_side: null })
        .eq('id', marketId)
      return json({ success: true, payouts: 0, result: 'no_bets' })
    }

    // 4b. Tie — refund every stake in full.
    if (totalNimA === totalNimB) {
      const refunds = []
      const failures = []
      for (const bet of bets) {
        const amountLuna = Math.floor(Number(bet.amount_nim) * 1e5)
        if (amountLuna < 1) continue
        try {
          const { data: payout } = await supabase
            .from('payouts')
            .insert({
              market_id: marketId,
              bet_id: bet.id,
              winner_address: bet.bettor_address,
              amount_nim: Number(bet.amount_nim),
              status: 'pending',
            })
            .select()
            .single()

          const txHash = await sendNimiqTransaction(
            houseAddress,
            housePrivateKey,
            bet.bettor_address,
            amountLuna,
            `notch:refund:${marketId.slice(0, 8)}`
          )

          await supabase
            .from('payouts')
            .update({ tx_hash: txHash, status: 'sent' })
            .eq('id', payout.id)
          await supabase
            .from('bets')
            .update({ status: 'paid', payout_amount: Number(bet.amount_nim), payout_tx_hash: txHash })
            .eq('id', bet.id)

          refunds.push({ address: bet.bettor_address, amount: Number(bet.amount_nim), txHash })
        } catch (err: any) {
          console.error(`Refund failed for ${bet.bettor_address}:`, err?.message || err)
          failures.push({ betId: bet.id, address: bet.bettor_address, error: err?.message || String(err) })
        }
      }

      await supabase
        .from('markets')
        .update({
          status: 'resolved',
          winning_side: null,
          resolution_tx_hashes: refunds.map((r) => r.txHash),
        })
        .eq('id', marketId)

      return json({ success: true, payouts: refunds.length, failed: failures.length, result: 'tie', results: refunds, failures })
    }

    // 5. Normal path — winners split (pool minus 5% house cut) pro-rata.
    const winningBets = bets.filter((b) => b.side === winningSide)
    const losingBets = bets.filter((b) => b.side !== winningSide)
    const totalPool = totalNimA + totalNimB
    const prizePool = totalPool * 0.95
    const totalWinningSide = winningBets.reduce((sum, bet) => sum + Number(bet.amount_nim), 0)

    const payoutResults = []
    const failedPayouts = []

    for (const bet of winningBets) {
      const share = totalWinningSide > 0 ? Number(bet.amount_nim) / totalWinningSide : 0
      const payoutAmount = prizePool * share
      const amountLuna = Math.floor(payoutAmount * 1e5)
      if (amountLuna < 1) continue

      try {
        const { data: payout } = await supabase
          .from('payouts')
          .insert({
            market_id: marketId,
            bet_id: bet.id,
            winner_address: bet.bettor_address,
            amount_nim: payoutAmount,
            status: 'pending',
          })
          .select()
          .single()

        const txHash = await sendNimiqTransaction(
          houseAddress,
          housePrivateKey,
          bet.bettor_address,
          amountLuna,
          `notch:payout:${marketId.slice(0, 8)}`
        )

        await supabase.from('payouts').update({ tx_hash: txHash, status: 'sent' }).eq('id', payout.id)
        await supabase
          .from('bets')
          .update({ status: 'paid', payout_amount: payoutAmount, payout_tx_hash: txHash })
          .eq('id', bet.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('address', bet.bettor_address)
          .maybeSingle()

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              win_count: profile.win_count + 1,
              total_nim_won: Number(profile.total_nim_won) + payoutAmount,
            })
            .eq('address', bet.bettor_address)
        }

        payoutResults.push({ address: bet.bettor_address, amount: payoutAmount, txHash })
      } catch (err: any) {
        console.error(`Payout failed for ${bet.bettor_address}:`, err?.message || err)
        failedPayouts.push({ betId: bet.id, address: bet.bettor_address, error: err?.message || String(err) })
      }
    }

    // 6. Losers: stats + mark lost.
    for (const bet of losingBets) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('address', bet.bettor_address)
          .maybeSingle()

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              loss_count: profile.loss_count + 1,
              total_nim_lost: Number(profile.total_nim_lost) + Number(bet.amount_nim),
            })
            .eq('address', bet.bettor_address)
        }

        await supabase.from('bets').update({ status: 'lost' }).eq('id', bet.id)
      } catch (err: any) {
        console.error('Loser update failed:', err?.message || err)
      }
    }

    // 7. Mark fully resolved.
    await supabase
      .from('markets')
      .update({
        status: 'resolved',
        winning_side: winningSide,
        resolution_tx_hashes: payoutResults.map((p) => p.txHash),
      })
      .eq('id', marketId)

    return json({
      success: true,
      payouts: payoutResults.length,
      failed: failedPayouts.length,
      results: payoutResults,
      failures: failedPayouts,
    })
  } catch (error: any) {
    return json({ error: error?.message || String(error) }, 500)
  }
})
