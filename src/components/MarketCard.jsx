import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProbability, getTimeRemaining, formatNim } from '../utils/markets.js'

const CATEGORY_COLORS = {
  crypto: { text: '#F6B221', bg: 'rgba(246, 178, 33, 0.1)' },
  sports: { text: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  culture: { text: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' },
  politics: { text: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  other: { text: '#888888', bg: 'rgba(136, 136, 136, 0.1)' },
}

function NimGlyph() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: '8px',
        height: '8px',
        background: '#F6B221',
        transform: 'rotate(45deg)',
        borderRadius: '1px',
        flexShrink: 0,
      }}
    />
  )
}

export default function MarketCard({ market, isNew = false, isRemoving = false }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000)
    return () => clearInterval(t)
  }, [])

  const prob = getProbability(market.total_nim_a, market.total_nim_b)
  const time = getTimeRemaining(market.duration_ends_at)
  const cat = CATEGORY_COLORS[market.category] || CATEGORY_COLORS.other
  const pool = (Number(market.total_nim_a) || 0) + (Number(market.total_nim_b) || 0)

  return (
    <Link
      to={`/market/${market.id}`}
      className="market-card"
      style={{
        display: 'block',
        background: '#141414',
        border: '1px solid #2a2a2a',
        borderRadius: '12px',
        padding: '16px',
        textDecoration: 'none',
        color: 'inherit',
        animation: isNew ? 'cardSlideIn 0.35s ease' : undefined,
        opacity: isRemoving ? 0 : 1,
        transition: 'opacity 0.3s ease, transform 0.1s ease',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '12px',
      }}>
        <span style={{
          fontSize: '0.7rem',
          fontWeight: 600,
          padding: '4px 10px',
          borderRadius: '999px',
          color: cat.text,
          background: cat.bg,
          textTransform: 'capitalize',
        }}>
          {market.category}
        </span>
        <span style={{
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '1px',
          color: '#888888',
        }}>
          {(market.type || '').toUpperCase()}
        </span>
      </div>

      <h3 style={{
        fontSize: '1.05rem',
        fontWeight: 700,
        color: '#ffffff',
        margin: '0 0 14px 0',
        lineHeight: 1.35,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {market.question}
      </h3>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: '6px',
      }}>
        <span style={{ fontSize: '0.85rem', color: '#ffffff' }}>
          {market.side_a_label}{' '}
          <strong style={{ fontWeight: 700 }}>{prob.a}%</strong>
        </span>
        <span style={{ fontSize: '0.85rem', color: '#ffffff' }}>
          <strong style={{ fontWeight: 700 }}>{prob.b}%</strong>{' '}
          {market.side_b_label}
        </span>
      </div>

      <div style={{
        width: '100%',
        height: '6px',
        borderRadius: '999px',
        background: '#333333',
        overflow: 'hidden',
        marginBottom: '14px',
      }}>
        <div style={{
          width: `${prob.a}%`,
          height: '100%',
          borderRadius: '999px',
          background: '#F6B221',
          transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
        color: '#888888',
      }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <NimGlyph />
          {formatNim(pool)}
        </span>
        <span>{market.total_bettors} bettors</span>
        <span style={{
          color: time.isClosed || time.isUrgent ? '#ef4444' : '#888888',
          fontWeight: time.isClosed || time.isUrgent ? 600 : 400,
        }}>
          {time.display}
        </span>
      </div>
    </Link>
  )
}
