import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveMarkets } from '../lib/db.js'
import { supabase } from '../lib/supabase.js'
import MarketCard from '../components/MarketCard.jsx'

const TABS = [
  { id: 'trending', label: 'Trending' },
  { id: 'newest', label: 'Newest' },
  { id: 'closing', label: 'Closing Soon' },
]

const PULL_THRESHOLD = 70

function findScrollTop(el) {
  let node = el
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.scrollHeight > node.clientHeight + 1) {
      const overflowY = window.getComputedStyle(node).overflowY
      if (overflowY === 'auto' || overflowY === 'scroll') {
        return node.scrollTop
      }
    }
    node = node.parentElement
  }
  return window.scrollY || 0
}

function SkeletonCard() {
  return (
    <div style={{
      background: '#141414',
      border: '1px solid #2a2a2a',
      borderRadius: '12px',
      padding: '16px',
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ width: '70px', height: '22px', borderRadius: '999px', background: '#1a1a1a' }} />
        <div style={{ width: '80px', height: '14px', borderRadius: '4px', background: '#1a1a1a' }} />
      </div>
      <div style={{ width: '90%', height: '20px', borderRadius: '4px', background: '#1a1a1a', marginBottom: '8px' }} />
      <div style={{ width: '60%', height: '20px', borderRadius: '4px', background: '#1a1a1a', marginBottom: '14px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ width: '70px', height: '14px', borderRadius: '4px', background: '#1a1a1a' }} />
        <div style={{ width: '70px', height: '14px', borderRadius: '4px', background: '#1a1a1a' }} />
      </div>
      <div style={{ width: '100%', height: '6px', borderRadius: '999px', background: '#1a1a1a', marginBottom: '14px' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ width: '80px', height: '14px', borderRadius: '4px', background: '#1a1a1a' }} />
        <div style={{ width: '60px', height: '14px', borderRadius: '4px', background: '#1a1a1a' }} />
        <div style={{ width: '50px', height: '14px', borderRadius: '4px', background: '#1a1a1a' }} />
      </div>
      <div className="skeleton-shimmer" />
    </div>
  )
}

export default function Feed() {
  const [sort, setSort] = useState('trending')
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [newIds, setNewIds] = useState([])
  const [removingIds, setRemovingIds] = useState([])
  const [pullDist, setPullDist] = useState(0)
  const [pullRefreshing, setPullRefreshing] = useState(false)
  const touchStartY = useRef(null)
  const touchAtTop = useRef(false)
  const sortRef = useRef(sort)
  sortRef.current = sort

  const fetchMarkets = useCallback(async (sortId, isInitial = false) => {
    if (isInitial) {
      setLoading(true)
    } else {
      setSwitching(true)
    }
    setLoadError(null)
    try {
      const data = await getActiveMarkets(sortId)
      setMarkets(Array.isArray(data) ? data : [])
    } catch (e) {
      setLoadError(e)
    } finally {
      setLoading(false)
      setSwitching(false)
    }
  }, [])

  useEffect(() => {
    fetchMarkets('trending', true)
  }, [fetchMarkets])

  const removeWithFade = useCallback((id) => {
    setRemovingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    setTimeout(() => {
      setMarkets((prev) => prev.filter((m) => m.id !== id))
      setRemovingIds((prev) => prev.filter((x) => x !== id))
    }, 300)
  }, [])

  useEffect(() => {
    let channel = null
    try {
      channel = supabase
        .channel('notch-feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'markets' }, (payload) => {
          const row = payload.new
          if (!row || row.status !== 'active') return
          setMarkets((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]))
          setNewIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]))
          setTimeout(() => {
            setNewIds((prev) => prev.filter((x) => x !== row.id))
          }, 500)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'markets' }, (payload) => {
          const row = payload.new
          if (!row) return
          if (row.status !== 'active') {
            removeWithFade(row.id)
            return
          }
          setMarkets((prev) => prev.map((m) => (m.id === row.id ? row : m)))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'markets' }, (payload) => {
          const old = payload.old
          if (old && old.id) removeWithFade(old.id)
        })
        .subscribe()
    } catch (_) {
      channel = null
    }
    return () => {
      try {
        if (channel) supabase.removeChannel(channel)
      } catch (_) { /* ignore */ }
    }
  }, [removeWithFade])

  const handleTab = (id) => {
    if (id === sort || switching || loading) return
    setSort(id)
    fetchMarkets(id, false)
  }

  const handleTouchStart = (e) => {
    if (pullRefreshing || loading) return
    touchStartY.current = e.touches[0].clientY
    touchAtTop.current = findScrollTop(e.target) <= 0
  }

  const handleTouchMove = (e) => {
    if (touchStartY.current == null || !touchAtTop.current || pullRefreshing || loading) return
    const d = e.touches[0].clientY - touchStartY.current
    if (d > 0) setPullDist(Math.min(d, 90))
    else setPullDist(0)
  }

  const handleTouchEnd = () => {
    if (pullDist >= PULL_THRESHOLD && !pullRefreshing && !loading) {
      setPullRefreshing(true)
      setPullDist(0)
      fetchMarkets(sortRef.current, false).finally(() => setPullRefreshing(false))
    } else {
      setPullDist(0)
    }
    touchStartY.current = null
    touchAtTop.current = false
  }

  return (
    <div
      style={{
        background: '#0a0a0a',
        minHeight: '100%',
        overflowX: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <style>{`
        .market-card { -webkit-tap-highlight-color: transparent; }
        .market-card:active { transform: scale(0.98); }
        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes feedFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .skeleton-shimmer {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          animation: shimmerSlide 1.4s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes pullSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#0a0a0a',
        display: 'flex',
        borderBottom: '1px solid #2a2a2a',
      }}>
        {TABS.map((t) => {
          const active = t.id === sort
          return (
            <button
              key={t.id}
              onClick={() => handleTab(t.id)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                padding: '14px 0 12px 0',
                fontSize: '0.9rem',
                fontWeight: 600,
                color: active ? '#ffffff' : '#888888',
                borderBottom: active ? '2px solid #F6B221' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {(pullDist > 0 || pullRefreshing) && (
        <div style={{
          height: pullRefreshing ? '56px' : `${pullDist}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          overflow: 'hidden',
          color: '#F6B221',
          fontSize: '0.85rem',
        }}>
          <span style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid #F6B221',
            borderTopColor: 'transparent',
            animation: 'pullSpin 0.8s linear infinite',
          }} />
          {pullDist >= PULL_THRESHOLD && !pullRefreshing ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      )}

      <div style={{ padding: '16px 16px 100px 16px' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : loadError ? (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <p style={{ color: '#fff', fontSize: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              Failed to load markets:{'\n'}{loadError?.message || String(loadError)}
            </p>
            <button
              onClick={() => fetchMarkets(sortRef.current, true)}
              style={{
                marginTop: '16px',
                background: '#F6B221',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                padding: '12px 24px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        ) : !markets || markets.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center' }}>
            <p style={{ color: '#888888', fontSize: '1rem', marginBottom: '20px' }}>
              No markets yet. Be the first to create one.
            </p>
            <Link
              to="/create"
              style={{
                display: 'inline-block',
                background: '#F6B221',
                color: '#000000',
                fontWeight: 700,
                fontSize: '0.95rem',
                padding: '12px 28px',
                borderRadius: '10px',
                textDecoration: 'none',
              }}
            >
              Create Market
            </Link>
          </div>
        ) : (
          <div
            key={sort}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'feedFadeIn 0.25s ease',
              opacity: switching ? 0.5 : 1,
              transition: 'opacity 0.2s ease',
            }}
          >
            {markets.map((m) => (
              <MarketCard
                key={m.id}
                market={m}
                isNew={newIds.includes(m.id)}
                isRemoving={removingIds.includes(m.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
