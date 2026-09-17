import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Share2, Check } from 'lucide-react'
import { useNimiq } from '../context/NimiqContext.jsx'
import {
  getMarketById,
  getBetsByMarket,
  getUserBetsOnMarket,
  resolveMarket,
} from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import { getProbability, getTimeRemaining, formatNim, timeAgo, potentialPayout } from '../utils/markets.js'
import BetSheet from '../components/BetSheet.jsx'
import ResolveSheet from '../components/ResolveSheet.jsx'

const CATEGORY_COLORS = {
  crypto: { text: '#F6B221', bg: 'rgba(246, 178, 33, 0.1)' },
  sports: { text: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  culture: { text: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  politics: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  other: { text: '#888888', bg: 'rgba(136, 136, 136, 0.1)' },
}

function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    const from = fromRef.current
    if (from === target) {
      setDisplay(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const val = Math.round(from + (target - from) * eased)
      setDisplay(val)
      fromRef.current = val
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return display
}

export default function MarketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { address } = useNimiq()

  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [bets, setBets] = useState([])
  const [userBets, setUserBets] = useState(null)
  const [newBetIds, setNewBetIds] = useState([])
  const [sheetSide, setSheetSide] = useState(null)
  const [resolveOpen, setResolveOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [critical, setCritical] = useState(null)
  const [, setTick] = useState(0)
  const toastTimer = useRef(null)

  const showToast = useCallback((msg, kind = 'green') => {
    setToast({ msg, kind })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000)
    return () => {
      clearInterval(t)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const fetchMarket = useCallback(async () => {
    try {
      const data = await getMarketById(id)
      setMarket(data)
      setLoadError(null)
    } catch (e) {
      setLoadError(e)
    } finally {
      setLoading(false)
    }
  }, [id])

  const fetchBets = useCallback(async () => {
    try {
      const data = await getBetsByMarket(id)
      setBets((Array.isArray(data) ? data : []).slice(0, 20))
    } catch (_) {
      setBets([])
    }
  }, [id])

  const fetchUserBets = useCallback(async () => {
    if (!address) {
      setUserBets([])
      return
    }
    try {
      const data = await getUserBetsOnMarket(id, address)
      setUserBets(data)
    } catch (_) {
      setUserBets([])
    }
  }, [id, address])

  useEffect(() => {
    fetchMarket()
    fetchBets()
  }, [fetchMarket, fetchBets])

  useEffect(() => {
    fetchUserBets()
  }, [fetchUserBets])

  useEffect(() => {
    let channel = null
    try {
      channel = supabase
        .channel(`market-detail-${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'markets', filter: `id=eq.${id}` },
          (payload) => {
            if (payload.new) setMarket(payload.new)
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'bets', filter: `market_id=eq.${id}` },
          (payload) => {
            const row = payload.new
            if (!row) return
            setBets((prev) => {
              if (prev.some((b) => b.id === row.id)) return prev
              return [row, ...prev].slice(0, 20)
            })
            setNewBetIds((prev) => [...prev, row.id])
            setTimeout(() => {
              setNewBetIds((prev) => prev.filter((x) => x !== row.id))
            }, 500)
            if (row.bettor_address === address) fetchUserBets()
          }
        )
        .subscribe()
    } catch (_) {
      channel = null
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch (_) { /* ignore */ }
    }
  }, [id, address, fetchUserBets])

  const prob = useMemo(
    () => (market ? getProbability(market.total_nim_a, market.total_nim_b) : { a: 50, b: 50 }),
    [market]
  )
  const heroPct = useCountUp(prob.a)

  if (loading) {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100%', padding: '16px 16px 100px 16px' }}>
        <div style={{ width: '120px', height: '20px', borderRadius: '4px', background: '#1a1a1a', marginBottom: '16px' }} />
        <div style={{ width: '90%', height: '28px', borderRadius: '4px', background: '#1a1a1a', marginBottom: '24px' }} />
        <div style={{ width: '120px', height: '72px', borderRadius: '8px', background: '#1a1a1a', margin: '0 auto 24px auto' }} />
        <div style={{ width: '100%', height: '12px', borderRadius: '999px', background: '#1a1a1a', marginBottom: '16px' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flex: 1, height: '52px', borderRadius: '12px', background: '#1a1a1a' }} />
          <div style={{ flex: 1, height: '52px', borderRadius: '12px', background: '#1a1a1a' }} />
        </div>
      </div>
    )
  }

  if (loadError || !market) {
    return (
      <div style={{ background: '#0a0a0a', minHeight: '100%', padding: '24px 16px', textAlign: 'center' }}>
        <p style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>
          {loadError ? `Failed to load market:\n${loadError?.message || String(loadError)}` : 'Market not found'}
        </p>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: '#F6B221', color: '#000', border: 'none', borderRadius: '10px',
            padding: '12px 24px', fontWeight: 700, cursor: 'pointer',
          }}
        >
          Go back
        </button>
      </div>
    )
  }

  const pool = (Number(market.total_nim_a) || 0) + (Number(market.total_nim_b) || 0)
  const time = getTimeRemaining(market.duration_ends_at)
  const expired = time.isClosed
  const resolved = market.status === 'resolved'
  const cat = CATEGORY_COLORS[market.category] || CATEGORY_COLORS.other
  const isCreator = address && market.creator_address === address
  const canResolve = isCreator && market.type === 'prediction' && market.status === 'active' && expired

  const heroLabel =
    pool === 0
      ? '50/50 — no bets yet'
      : prob.a > prob.b
        ? `${market.side_a_label} is winning`
        : prob.b > prob.a
          ? `${market.side_b_label} is winning`
          : 'Dead even'

  const userTotals = { a: 0, b: 0 }
  if (Array.isArray(userBets)) {
    for (const b of userBets) {
      if (b.side === 'a' || b.side === 'b') userTotals[b.side] += Number(b.amount_nim) || 0
    }
  }
  const backedSides = ['a', 'b'].filter((s) => userTotals[s] > 0)
  const backedLabel = (s) => (s === 'a' ? market.side_a_label : market.side_b_label)

  const leading = prob.a > prob.b ? 'a' : prob.b > prob.a ? 'b' : null

  const betBtnStyle = (s) => {
    const isLeading = leading === s
    if (!leading) {
      return { background: 'transparent', color: '#fff', border: '1px solid #F6B221' }
    }
    return isLeading
      ? { background: '#F6B221', color: '#000', border: '1px solid #F6B221' }
      : { background: '#1a1a1a', color: '#fff', border: '1px solid #F6B221' }
  }

  const handleBetClick = (s) => {
    if (resolved || market.status !== 'active') return
    if (expired) {
      showToast('This market has closed', 'red')
      return
    }
    setSheetSide(s)
  }

  const handlePlaced = () => {
    setSheetSide(null)
    showToast('Bet placed!', 'green')
    fetchBets()
    fetchUserBets()
    fetchMarket()
  }

  const handleCritical = ({ txHash, message }) => {
    setSheetSide(null)
    setCritical({ txHash, message })
  }

  const handleShare = () => {
    const url = `https://notchlabs.vercel.app/market/${market.id}`
    try {
      if (!navigator.clipboard?.writeText) {
        showToast('Copy not supported here', 'red')
        return
      }
      navigator.clipboard.writeText(url)
      showToast('Link copied!', 'green')
    } catch (_) {
      showToast('Copy failed', 'red')
    }
  }

  const handleResolveConfirm = async (winningSide) => {
    setResolveOpen(false)
    showToast('Market resolved', 'green')
    fetchMarket()
    return winningSide
  }

  const winningLabel = resolved && market.winning_side
    ? backedLabel(market.winning_side)
    : null
  const userWon = resolved && market.winning_side && userTotals[market.winning_side] > 0
  const userLost = resolved && backedSides.length > 0 && !userWon
  const winAmount = userWon
    ? potentialPayout(
        userTotals[market.winning_side],
        market.winning_side === 'a' ? market.total_nim_a : market.total_nim_b,
        pool
      )
    : 0

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100%', paddingBottom: '100px', overflowX: 'hidden' }}>
      <style>{`
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50, background: '#0a0a0a',
        borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', padding: '12px 16px',
      }}>
        <button
          onClick={() => navigate(-1)}
          aria-label="Go back"
          style={{ background: 'transparent', border: 'none', color: '#fff', display: 'flex', padding: '4px', cursor: 'pointer', minWidth: '44px', minHeight: '44px', alignItems: 'center' }}
        >
          <ArrowLeft size={22} />
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <span style={{
            fontSize: '0.7rem', fontWeight: 600, padding: '4px 12px', borderRadius: '999px',
            color: cat.text, background: cat.bg, textTransform: 'capitalize',
          }}>
            {market.category}
          </span>
        </div>
        <button
          onClick={handleShare}
          aria-label="Share market"
          style={{ background: 'transparent', border: 'none', color: '#fff', display: 'flex', padding: '4px', cursor: 'pointer', minWidth: '44px', minHeight: '44px', alignItems: 'center', justifyContent: 'center' }}
        >
          <Share2 size={20} />
        </button>
      </div>

      <div style={{ padding: '20px 16px 0 16px' }}>
        <h1 style={{
          color: '#fff', fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.35, margin: '0 0 24px 0',
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {market.question}
        </h1>

        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ color: '#F6B221', fontSize: '72px', fontWeight: 700, lineHeight: 1 }}>
            {heroPct}%
          </div>
          <div style={{ color: '#fff', fontSize: '1rem', marginTop: '8px' }}>
            {heroLabel}
          </div>
        </div>

        <div style={{ width: '100%', height: '12px', borderRadius: '999px', background: '#333333', overflow: 'hidden', marginBottom: '8px' }}>
          <div style={{
            width: `${prob.a}%`, height: '100%', borderRadius: '999px',
            background: '#F6B221', transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '0.85rem', color: '#fff' }}>
          <span>{market.side_a_label} {prob.a}%</span>
          <span>{market.side_b_label} {prob.b}%</span>
        </div>

        <div style={{
          display: 'flex', background: '#141414', border: '1px solid #2a2a2a',
          borderRadius: '12px', padding: '14px 8px', marginBottom: '16px',
        }}>
          {[
            { label: 'Total pool', value: formatNim(pool) },
            { label: 'Bettors', value: String(market.total_bettors) },
            { label: 'Time left', value: time.display, urgent: time.isClosed || time.isUrgent },
          ].map((s) => (
            <div key={s.label} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ color: s.urgent ? '#ef4444' : '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                {s.value}
              </div>
              <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {resolved ? (
          <div>
            <div style={{
              background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', borderRadius: '12px',
              padding: '16px', textAlign: 'center', marginBottom: '16px',
            }}>
              <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '1.1rem' }}>
                {winningLabel} Won
              </span>
            </div>
            {userWon && (
              <div style={{
                background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px',
                padding: '16px', textAlign: 'center', marginBottom: '16px',
              }}>
                <span style={{ color: '#22c55e', fontWeight: 700, fontSize: '1rem' }}>
                  You won {winAmount.toFixed(2)} NIM
                </span>
              </div>
            )}
            {userLost && (
              <div style={{
                background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px',
                padding: '16px', textAlign: 'center', marginBottom: '16px',
              }}>
                <span style={{ color: '#888', fontSize: '1rem' }}>Better luck next time</span>
              </div>
            )}
          </div>
        ) : expired ? (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <p style={{ color: '#ef4444', fontWeight: 600, margin: '0 0 12px 0' }}>This market has closed</p>
            {canResolve && (
              <button
                onClick={() => setResolveOpen(true)}
                style={{
                  width: '100%', background: '#fff', color: '#000', border: 'none',
                  borderRadius: '12px', padding: '16px', fontSize: '1rem', fontWeight: 700,
                  cursor: 'pointer', minHeight: '44px',
                }}
              >
                Resolve Market
              </button>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '16px' }}>
            {backedSides.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px', color: '#F6B221', fontSize: '0.85rem', fontWeight: 600 }}>
                <Check size={16} />
                You backed {backedSides.map(backedLabel).join(' + ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px' }}>
              {['a', 'b'].map((s) => (
                <button
                  key={s}
                  onClick={() => handleBetClick(s)}
                  style={{
                    flex: 1, borderRadius: '12px', padding: '16px 8px', fontSize: '0.95rem',
                    fontWeight: 700, cursor: 'pointer', minHeight: '52px', ...betBtnStyle(s),
                  }}
                >
                  {backedLabel(s)}
                </button>
              ))}
            </div>
          </div>
        )}

        {!resolved && backedSides.length > 0 && (
          <div style={{
            background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px',
            padding: '16px', marginBottom: '20px',
          }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', margin: '0 0 12px 0' }}>
              Your Position
            </p>
            {backedSides.map((s) => {
              const sideTotal = s === 'a' ? market.total_nim_a : market.total_nim_b
              const payout = potentialPayout(userTotals[s], sideTotal, pool)
              const winning = leading === null ? null : leading === s
              return (
                <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>
                    {backedLabel(s)} — {formatNim(userTotals[s])}
                  </span>
                  <span style={{
                    color: winning === null ? '#fff' : winning ? '#22c55e' : '#ef4444',
                    fontSize: '0.85rem', fontWeight: 600,
                  }}>
                    {winning === false ? 'Losing · ' : ''}~{payout.toFixed(2)} NIM to win
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <h2 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0' }}>
          Recent Bets
        </h2>
        {bets.length === 0 ? (
          <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 16px 0' }}>
            No bets yet. Be the first.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
            {bets.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  background: '#141414', border: '1px solid #2a2a2a', borderRadius: '10px',
                  padding: '10px 12px', fontSize: '0.8rem',
                  animation: newBetIds.includes(b.id) ? 'cardSlideIn 0.35s ease' : undefined,
                }}
              >
                <span style={{ color: '#fff', fontWeight: 600 }}>{shortenAddress(b.bettor_address)}</span>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: '999px',
                  background: b.side === 'a' ? 'rgba(246, 178, 33, 0.15)' : 'rgba(136,136,136,0.15)',
                  color: b.side === 'a' ? '#F6B221' : '#888',
                }}>
                  {b.side === 'a' ? market.side_a_label : market.side_b_label}
                </span>
                <span style={{ color: '#888', marginLeft: 'auto' }}>{formatNim(b.amount_nim)}</span>
                <span style={{ color: '#555' }}>{timeAgo(b.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {sheetSide && !resolved && (
        <BetSheet
          market={market}
          side={sheetSide}
          onClose={() => setSheetSide(null)}
          onPlaced={handlePlaced}
          onCritical={handleCritical}
        />
      )}

      {resolveOpen && (
        <ResolveSheet
          market={market}
          onClose={() => setResolveOpen(false)}
          onResolved={handleResolveConfirm}
          onError={(msg) => showToast(msg, 'red')}
        />
      )}

      {critical && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}>
          <div style={{
            background: '#141414', border: '1px solid #ef4444', borderRadius: '12px',
            padding: '20px', maxWidth: '400px', width: '100%',
          }}>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '1rem', margin: '0 0 8px 0' }}>
              Bet sent on-chain but failed to save.
            </p>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 8px 0' }}>
              Contact support with tx hash:
            </p>
            <p style={{ color: '#fff', fontSize: '0.8rem', wordBreak: 'break-all', margin: '0 0 16px 0' }}>
              {critical.txHash}
            </p>
            <button
              onClick={() => setCritical(null)}
              style={{
                width: '100%', background: '#F6B221', color: '#000', border: 'none',
                borderRadius: '10px', padding: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed', left: '16px', right: '16px', bottom: '80px', zIndex: 250000,
          background: toast.kind === 'red' ? '#ef4444' : '#22c55e', color: '#fff',
          borderRadius: '10px', padding: '14px 16px', fontSize: '0.9rem', fontWeight: 600,
          textAlign: 'center',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
