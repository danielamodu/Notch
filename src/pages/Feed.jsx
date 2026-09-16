import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getActiveMarkets } from '../lib/db.js'

export default function Feed() {
  const [markets, setMarkets] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  useEffect(() => {
    getActiveMarkets('trending')
      .then((data) => {
        setMarkets(data)
        setLoadError(null)
      })
      .catch((e) => setLoadError(e))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading markets…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: '#fff', fontSize: '18px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          Failed to load markets:{'\n'}{loadError?.message || String(loadError)}
        </p>
      </div>
    )
  }

  if (!markets || markets.length === 0) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No markets yet. Be the first to create one!</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      {markets.map((m) => (
        <Link
          key={m.id}
          to={`/market/${m.id}`}
          style={{
            display: 'block',
            padding: '16px',
            marginBottom: '12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <h3 style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            {m.question}
          </h3>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '8px',
          }}>
            <span style={{
              fontSize: '0.8rem',
              padding: '4px 8px',
              background: 'var(--surface-elevated)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}>
              {m.side_a_label}
            </span>
            <span style={{
              fontSize: '0.8rem',
              padding: '4px 8px',
              background: 'var(--surface-elevated)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
            }}>
              {m.side_b_label}
            </span>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}>
            <span>Pool: {Number(m.total_nim_a) + Number(m.total_nim_b)} NIM</span>
            <span>{m.total_bettors} bettors</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
