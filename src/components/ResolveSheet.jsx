import { useState } from 'react'
import { resolveMarket } from '../lib/db.js'

export default function ResolveSheet({ market, onClose, onResolved, onError }) {
  const [selected, setSelected] = useState(null)
  const [phase, setPhase] = useState('idle')

  const handleConfirm = async () => {
    if (!selected || phase !== 'idle') return
    setPhase('busy')
    try {
      await resolveMarket(market.id, selected)
      onResolved(selected)
    } catch (err) {
      setPhase('idle')
      onError(err?.message || 'Failed to resolve market')
    }
  }

  const sideBtn = (sideId, label) => {
    const active = selected === sideId
    return (
      <button
        key={sideId}
        onClick={() => setSelected(sideId)}
        style={{
          flex: 1,
          background: active ? 'rgba(246, 178, 33, 0.2)' : '#1a1a1a',
          color: active ? '#F6B221' : '#fff',
          border: `1px solid ${active ? '#F6B221' : '#2a2a2a'}`,
          borderRadius: '12px',
          padding: '20px 12px',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: 'pointer',
          minHeight: '64px',
        }}
      >
        {label}
      </button>
    )
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
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 16px 0' }}>
          <div style={{ width: '40px', height: '4px', borderRadius: '999px', background: '#333333' }} />
        </div>

        <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px 0', textAlign: 'center' }}>
          Resolve Market
        </h2>
        <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 20px 0', textAlign: 'center' }}>
          Which side won?
        </p>

        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          {sideBtn('a', market.side_a_label)}
          {sideBtn('b', market.side_b_label)}
        </div>

        <p style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          This cannot be undone. Winners will be paid out automatically.
        </p>

        <button
          onClick={handleConfirm}
          disabled={!selected || phase !== 'idle'}
          style={{
            width: '100%',
            background: selected && phase === 'idle' ? '#ffffff' : '#333',
            color: selected && phase === 'idle' ? '#000' : '#888',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: selected && phase === 'idle' ? 'pointer' : 'not-allowed',
            minHeight: '44px',
          }}
        >
          {phase === 'busy'
            ? 'Resolving...'
            : selected
              ? `Resolve — ${(selected === 'a' ? market.side_a_label : market.side_b_label)} Wins`
              : 'Pick a winner above'}
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'transparent',
            border: 'none',
            color: '#888',
            fontSize: '0.95rem',
            padding: '12px',
            marginTop: '4px',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
