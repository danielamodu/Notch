import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getMarketById } from '../lib/db.js'

export default function MarketDetail() {
  const { id } = useParams()
  const [market, setMarket] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getMarketById(id)
      .then(setMarket)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading market…</p>
      </div>
    )
  }

  if (!market) {
    return (
      <div style={{ padding: '16px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Market not found</p>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '16px',
      }}>
        {market.question}
      </h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Market detail page — betting UI coming soon.
      </p>
    </div>
  )
}
