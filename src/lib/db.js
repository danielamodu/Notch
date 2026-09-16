import { supabase } from './supabase.js'

function throwIfError({ error }, context) {
  if (error) throw new Error(`${context}: ${error.message}`)
}

// ---------------- Markets ----------------

const MARKET_SORT = {
  trending: { column: 'total_bettors', ascending: false },
  newest: { column: 'created_at', ascending: false },
  closing: { column: 'duration_ends_at', ascending: true }
}

export async function getActiveMarkets(sortBy = 'trending') {
  const sort = MARKET_SORT[sortBy] ?? MARKET_SORT.trending
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('status', 'active')
    .order(sort.column, { ascending: sort.ascending })
  throwIfError({ error }, 'getActiveMarkets failed')
  return data
}

export async function getMarketById(id) {
  const { data, error } = await supabase
    .from('markets')
    .select('*')
    .eq('id', id)
    .single()
  throwIfError({ error }, 'getMarketById failed')
  return data
}

export async function createMarket(marketData) {
  const { data, error } = await supabase
    .from('markets')
    .insert(marketData)
    .select()
    .single()
  throwIfError({ error }, 'createMarket failed')
  return data
}

export async function updateMarketOdds(marketId, side, amountNim) {
  const { error } = await supabase.rpc('update_market_odds', {
    p_market_id: marketId,
    p_side: side,
    p_amount: amountNim
  })
  throwIfError({ error }, 'updateMarketOdds failed')
}

export async function resolveMarket(marketId, winningSide) {
  if (!['a', 'b'].includes(winningSide)) {
    throw new Error("resolveMarket failed: winningSide must be 'a' or 'b'")
  }
  const { data, error } = await supabase
    .from('markets')
    .update({
      status: 'resolved',
      winning_side: winningSide,
      resolved_at: new Date().toISOString()
    })
    .eq('id', marketId)
    .select()
    .single()
  throwIfError({ error }, 'resolveMarket failed')
  return data
}

// ---------------- Bets ----------------

export async function placeBet(betData) {
  const { data, error } = await supabase
    .from('bets')
    .insert(betData)
    .select()
    .single()
  throwIfError({ error }, 'placeBet failed')
  return data
}

export async function getBetsByMarket(marketId) {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
  throwIfError({ error }, 'getBetsByMarket failed')
  return data
}

export async function getBetsByAddress(address) {
  const { data, error } = await supabase
    .from('bets')
    .select('*, markets(*)')
    .eq('bettor_address', address)
    .order('created_at', { ascending: false })
  throwIfError({ error }, 'getBetsByAddress failed')
  return data
}

export async function getMyBetOnMarket(marketId, address) {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('market_id', marketId)
    .eq('bettor_address', address)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  throwIfError({ error }, 'getMyBetOnMarket failed')
  return data
}

// ---------------- Profiles ----------------

export async function getProfile(address) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('address', address)
    .maybeSingle()
  throwIfError({ error }, 'getProfile failed')
  return data
}

export async function upsertProfile(address, data = {}) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .upsert({ address, ...data }, { onConflict: 'address' })
    .select()
    .single()
  throwIfError({ error }, 'upsertProfile failed')
  return profile
}

// ---------------- Payouts ----------------
// NOTE: payouts are written by the backend with the service_role
// key (RLS denies anon/authenticated writes). createPayout below
// works when called backend-side; from the Mini App it will fail
// by design — use it for reads (getPayoutsByMarket) client-side.

export async function createPayout(payoutData) {
  const { data, error } = await supabase
    .from('payouts')
    .insert(payoutData)
    .select()
    .single()
  throwIfError({ error }, 'createPayout failed')
  return data
}

export async function getPayoutsByMarket(marketId) {
  const { data, error } = await supabase
    .from('payouts')
    .select('*')
    .eq('market_id', marketId)
    .order('created_at', { ascending: false })
  throwIfError({ error }, 'getPayoutsByMarket failed')
  return data
}
