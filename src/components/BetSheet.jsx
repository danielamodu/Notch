import { useMemo, useState } from 'react'
import { useNimiq } from '../context/NimiqContext.jsx'
import { placeBet, updateMarketOdds, getProfile, upsertProfile } from '../lib/db.js'
import { getProbability, getTimeRemaining, potentialPayout } from '../utils/markets.js'

const MIN_BET_NIM = 0.1
const QUICK_AMOUNTS = ['0.5', '1', '2', '5', '10']

function buildMemo(marketId, side, address) {
  const full = `notch:bet:${marketId}:${side}:${address}`
  try {
    if (new TextEncoder().encode(full).length <= 64) return full
  } catch (_) { /* fall through to short memo */ }
  return `nb:${String(marketId).slice(0, 8)}:${side}:${String(address).slice(-8)}`
}

export default function BetSheet({ market, side, onClose, onPlaced, onCritical }) {
  const { address, sendTransaction } = useNimiq()
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState('idle')
  const [error, setError] = useState(null)

  const sideLabel = side === 'a' ? market.side_a_label : market.side_b_label
  const prob = getProbability(market.total_nim_a, market.total_nim_b)
  const sidePct = side === 'a' ? prob.a : prob.b

  const amountNum = useMemo(() => {
    const n = Number(amount)
    return Number.isFinite(n) ? n : NaN
  }, [amount])

  const payout = useMemo(() => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return 0
    const sideTotal = side === 'a' ? market.total_nim_a : market.total_nim_b
    const pool = (Number(market.total_nim_a) || 0) + (Number(market.total_nim_b) || 0)
    return potentialPayout(amountNum, sideTotal, pool)
  }, [amountNum, side, market])

  const valid = Number.isFinite(amountNum) && amountNum >= MIN_BET_NIM

  const handleConfirm = async () => {
    if (phase !== 'idle') return
    setError(null)

    if (!valid) {
      setError('Minimum bet is 0.1 NIM')
      return
    }
    const time = getTimeRemaining(market.duration_ends_at)
    if (market.status !== 'active' || time.isClosed) {
      setError('This market has closed')
      return
    }

    const memo = buildMemo(market.id, side, address)

    setPhase('tx')
    let txHash
    try {
      const result = await sendTransaction(amountNum, memo)
      txHash = result.hash
    } catch (err) {
      setPhase('idle')
      setError(err?.message || 'Bet cancelled')
      return
    }

    try {
      await placeBet({
        market_id: market.id,
        bettor_address: address,
        side,
        amount_nim: amountNum,
        tx_hash: txHash,
        tx_memo: memo,
        status: 'confirmed',
      })
      await updateMarketOdds(market.id, side, amountNum)
    } catch (err) {
      console.error('[Notch] Bet on-chain but Supabase write failed', err, { marketId: market.id, side, amount: amountNum, txHash })
      setPhase('idle')
      onCritical({ txHash, message: err?.message || String(err) })
      return
    }

    try {
      const existing = await getProfile(address)
      await upsertProfile(address, {
        total_bets_placed: (existing?.total_bets_placed || 0) + 1,
      })
    } catch (err) {
      console.error('[Notch] Profile bet-count increment failed (non-blocking)', err)
    }

    onPlaced()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes notchSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#141414',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          border: '1px solid #2a2a2a',
          borderBottom: 'none',
          padding: '12px 20px 32px 20px',
          animation: 'sheetUp 0.25s ease',
          maxHeight: '88vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 16px 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: '#333333' }} />
        </div>

        <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px 0', textAlign: 'center' }}>
          Bet on {sideLabel}
        </h2>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 20px 0', textAlign: 'center' }}>
          This side is at {sidePct}%
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0.0"
            autoFocus
            style={{
              width: '160px',
              background: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: '12px',
              color: '#fff',
              fontSize: '2rem',
              fontWeight: 700,
              textAlign: 'center',
              padding: '12px 8px',
              outline: 'none',
            }}
          />
          <span style={{ color: '#888', fontSize: '1rem', fontWeight: 600 }}>NIM</span>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              onClick={() => setAmount(q)}
              style={{
                background: amount === q ? 'rgba(246, 178, 33, 0.2)' : '#1a1a1a',
                color: amount === q ? '#F6B221' : '#888',
                border: `1px solid ${amount === q ? '#F6B221' : '#2a2a2a'}`,
                borderRadius: '999px',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                minHeight: '44px',
              }}
            >
              {q}
            </button>
          ))}
        </div>

        <p style={{ color: '#22c55e', fontSize: '0.95rem', fontWeight: 600, textAlign: 'center', margin: '0 0 20px 0' }}>
          If you win: ~{payout.toFixed(2)} NIM
        </p>

        {error && (
          <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', margin: '0 0 12px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {error}
          </p>
        )}

        <button
          onClick={onClose}
          disabled={phase === 'tx'}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '0.95rem',
            padding: '12px',
            marginBottom: '8px',
            cursor: phase === 'tx' ? 'default' : 'pointer',
            minHeight: '44px',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={phase === 'tx'}
          style={{
            width: '100%',
            background: phase === 'tx' ? '#333' : '#F6B221',
            color: phase === 'tx' ? '#888' : '#000',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: phase === 'tx' ? 'default' : 'pointer',
            minHeight: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
          }}
        >
          {phase === 'tx' && (
            <span style={{
              display: 'inline-block',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '3px solid #555',
              borderTopColor: '#F6B221',
              animation: 'notchSpin 0.9s linear infinite',
            }} />
          )}
          {phase === 'tx'
            ? 'Placing your bet... Do not close'
            : `Confirm Bet — ${Number.isFinite(amountNum) && amountNum > 0 ? amountNum : '0'} NIM`}
        </button>
      </div>
    </div>
  )
}
