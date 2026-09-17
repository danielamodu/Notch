import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Info, Check } from 'lucide-react'
import { useNimiq } from '../context/NimiqContext.jsx'
import { createMarket, getProfile, upsertProfile } from '../lib/db.js'

const CREATION_FEE_NIM = 0.1

const CATEGORIES = [
  { id: 'crypto', label: 'Crypto', color: '#F6B221', bg: 'rgba(246, 178, 33, 0.2)' },
  { id: 'sports', label: 'Sports', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
  { id: 'culture', label: 'Culture', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.2)' },
  { id: 'politics', label: 'Politics', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
  { id: 'other', label: 'Other', color: '#888888', bg: 'rgba(136, 136, 136, 0.2)' },
]

const TYPES = [
  { id: 'opinion', title: 'Opinion', desc: 'Crowd decides — majority NIM wins automatically' },
  { id: 'prediction', title: 'Prediction', desc: 'You resolve — pick the winner when it ends' },
]

const DURATIONS = [
  { id: '1h', label: '1h', ms: 60 * 60 * 1000 },
  { id: '6h', label: '6h', ms: 6 * 60 * 60 * 1000 },
  { id: '24h', label: '24h', ms: 24 * 60 * 60 * 1000 },
  { id: '3d', label: '3d', ms: 3 * 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
]

function generateMarketId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch (_) { /* fall through */ }
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const b = new Uint8Array(16)
      crypto.getRandomValues(b)
      b[6] = (b[6] & 0x0f) | 0x40
      b[8] = (b[8] & 0x3f) | 0x80
      const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
    }
  } catch (_) { /* fall through */ }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : ((r & 0x3) | 0x8)).toString(16)
  })
}

const inputBase = {
  width: '100%',
  background: '#141414',
  border: '1px solid #2a2a2a',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '1rem',
  padding: '12px 14px',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function CreateMarket() {
  const navigate = useNavigate()
  const { address, sendTransaction } = useNimiq()

  const [question, setQuestion] = useState('')
  const [sideA, setSideA] = useState('Yes')
  const [sideB, setSideB] = useState('No')
  const [category, setCategory] = useState(null)
  const [type, setType] = useState(null)
  const [duration, setDuration] = useState('24h')
  const [focused, setFocused] = useState(null)
  const [errors, setErrors] = useState({})
  const [phase, setPhase] = useState('idle')
  const [toast, setToast] = useState(null)
  const [criticalError, setCriticalError] = useState(null)

  const questionRef = useRef(null)
  const sideARef = useRef(null)
  const sideBRef = useRef(null)
  const categoryRef = useRef(null)
  const typeRef = useRef(null)
  const toastTimer = useRef(null)

  useEffect(() => {
    if (questionRef.current) questionRef.current.focus()
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const validate = () => {
    const e = {}
    const q = question.trim()
    if (!q) e.question = 'Question is required'
    else if (q.length < 10) e.question = 'Question must be at least 10 characters'
    if (!sideA.trim()) e.sideA = 'Side A label is required'
    if (!sideB.trim()) e.sideB = 'Side B label is required'
    if (!category) e.category = 'Pick a category'
    if (!type) e.type = 'Pick a market type'
    return e
  }

  const isValid =
    question.trim().length >= 10 &&
    question.trim().length <= 200 &&
    sideA.trim().length >= 1 &&
    sideB.trim().length >= 1 &&
    !!category &&
    !!type &&
    !!duration

  const scrollToFirstError = (e) => {
    const order = [
      ['question', questionRef],
      ['sideA', sideARef],
      ['sideB', sideBRef],
      ['category', categoryRef],
      ['type', typeRef],
    ]
    for (const [key, ref] of order) {
      if (e[key] && ref.current) {
        ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        if (ref.current.focus && (key === 'question' || key === 'sideA' || key === 'sideB')) {
          setTimeout(() => ref.current.focus({ preventScroll: true }), 400)
        }
        break
      }
    }
  }

  const handleSubmit = async () => {
    if (phase !== 'idle') return
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) {
      scrollToFirstError(e)
      return
    }

    const marketId = generateMarketId()
    const memo = `notch:create:${marketId}`
    const durationMs = (DURATIONS.find((d) => d.id === duration) || DURATIONS[2]).ms
    const endsAt = new Date(Date.now() + durationMs)

    let txHash
    setPhase('tx')
    try {
      const result = await sendTransaction(CREATION_FEE_NIM, memo)
      txHash = result.hash
    } catch (err) {
      setPhase('idle')
      showToast(err?.message || 'Transaction cancelled')
      return
    }

    const marketData = {
      id: marketId,
      creator_address: address,
      creation_tx_hash: txHash,
      question: question.trim(),
      side_a_label: sideA.trim(),
      side_b_label: sideB.trim(),
      category,
      type,
      duration_ends_at: endsAt.toISOString(),
      status: 'active',
      total_nim_a: 0,
      total_nim_b: 0,
      total_bettors: 0,
      share_url: `https://notchlabs.vercel.app/market/${marketId}`,
    }

    try {
      await createMarket(marketData)
    } catch (err) {
      console.error('[Notch] Market created on-chain but Supabase insert failed', err, marketData)
      setPhase('idle')
      setCriticalError({ txHash, message: err?.message || String(err) })
      return
    }

    try {
      const existing = await getProfile(address)
      await upsertProfile(address, {
        total_markets_created: (existing?.total_markets_created || 0) + 1,
      })
    } catch (err) {
      console.error('[Notch] Profile increment failed (non-blocking)', err)
    }

    setPhase('success')
    setTimeout(() => navigate(`/market/${marketId}`), 1500)
  }

  const fieldError = (msg) =>
    msg ? (
      <p style={{ color: '#ef4444', fontSize: '0.8rem', margin: '6px 0 0 0' }}>{msg}</p>
    ) : null

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100%', paddingBottom: '100px' }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#0a0a0a',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
      }}>
        <Link to="/" style={{ color: '#ffffff', display: 'flex', padding: '4px' }} aria-label="Back to feed">
          <ArrowLeft size={22} />
        </Link>
        <h1 style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '1.1rem',
          fontWeight: 700,
          color: '#ffffff',
          margin: 0,
          marginRight: '30px',
        }}>
          New Market
        </h1>
      </div>

      <div style={{ padding: '20px 16px 0 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div ref={questionRef}>
          <textarea
            ref={questionRef}
            value={question}
            onChange={(ev) => setQuestion(ev.target.value.slice(0, 200))}
            onFocus={() => setFocused('question')}
            onBlur={() => setFocused(null)}
            placeholder="What do you want the world to decide on?"
            rows={3}
            autoFocus
            enterKeyHint="next"
            style={{
              ...inputBase,
              resize: 'none',
              fontSize: '1.1rem',
              fontWeight: 600,
              lineHeight: 1.4,
              borderColor: focused === 'question' ? '#F6B221' : '#2a2a2a',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: '#888888' }}>{question.length}/200</span>
          </div>
          {fieldError(errors.question)}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <div ref={sideARef} style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#888888', marginBottom: '6px' }}>
              Side A
            </label>
            <input
              ref={sideARef}
              type="text"
              value={sideA}
              onChange={(ev) => setSideA(ev.target.value.slice(0, 20))}
              onFocus={() => setFocused('sideA')}
              onBlur={() => setFocused(null)}
              maxLength={20}
              enterKeyHint="next"
              style={{ ...inputBase, borderColor: focused === 'sideA' ? '#F6B221' : '#2a2a2a' }}
            />
            {fieldError(errors.sideA)}
          </div>
          <div ref={sideBRef} style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#888888', marginBottom: '6px' }}>
              Side B
            </label>
            <input
              ref={sideBRef}
              type="text"
              value={sideB}
              onChange={(ev) => setSideB(ev.target.value.slice(0, 20))}
              onFocus={() => setFocused('sideB')}
              onBlur={() => setFocused(null)}
              maxLength={20}
              enterKeyHint="done"
              style={{ ...inputBase, borderColor: focused === 'sideB' ? '#F6B221' : '#2a2a2a' }}
            />
            {fieldError(errors.sideB)}
          </div>
        </div>

        <div ref={categoryRef}>
          <p style={{ fontSize: '0.8rem', color: '#888888', margin: '0 0 8px 0' }}>Category</p>
          <div style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            margin: '0 -16px',
            paddingLeft: '16px',
            paddingRight: '16px',
          }}>
            {CATEGORIES.map((c) => {
              const selected = category === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  style={{
                    flexShrink: 0,
                    background: selected ? c.bg : '#1a1a1a',
                    color: selected ? c.color : '#888888',
                    border: `1px solid ${selected ? c.color : '#2a2a2a'}`,
                    borderRadius: '999px',
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          {fieldError(errors.category)}
        </div>

        <div ref={typeRef}>
          <p style={{ fontSize: '0.8rem', color: '#888888', margin: '0 0 8px 0' }}>Market type</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {TYPES.map((t) => {
              const selected = type === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  style={{
                    textAlign: 'left',
                    background: '#141414',
                    border: `1px solid ${selected ? '#F6B221' : '#2a2a2a'}`,
                    borderRadius: '12px',
                    padding: '14px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ color: selected ? '#ffffff' : '#888888', fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                    {t.title}
                  </div>
                  <div style={{ color: '#888888', fontSize: '0.8rem', lineHeight: 1.4 }}>
                    {t.desc}
                  </div>
                </button>
              )
            })}
          </div>
          {fieldError(errors.type)}
        </div>

        <div>
          <p style={{ fontSize: '0.8rem', color: '#888888', margin: '0 0 8px 0' }}>Duration</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {DURATIONS.map((d) => {
              const selected = duration === d.id
              return (
                <button
                  key={d.id}
                  onClick={() => setDuration(d.id)}
                  style={{
                    background: selected ? 'rgba(246, 178, 33, 0.2)' : '#1a1a1a',
                    color: selected ? '#F6B221' : '#888888',
                    border: `1px solid ${selected ? '#F6B221' : '#2a2a2a'}`,
                    borderRadius: '999px',
                    padding: '8px 18px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
          <Info size={14} style={{ color: '#888888', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ color: '#888888', fontSize: '0.8rem', margin: 0, lineHeight: 1.5 }}>
            Creating a market costs 0.1 NIM — recorded on-chain as proof of creation
          </p>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isValid || phase !== 'idle'}
          style={{
            width: '100%',
            background: isValid && phase === 'idle' ? '#F6B221' : '#333333',
            color: isValid && phase === 'idle' ? '#000000' : '#888888',
            border: 'none',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 700,
            cursor: isValid && phase === 'idle' ? 'pointer' : 'not-allowed',
          }}
        >
          Create Market
        </button>
      </div>

      {phase === 'tx' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#000000',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '24px',
          textAlign: 'center',
        }}>
          <style>{`
            @keyframes notchSpin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <span style={{
            display: 'inline-block',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '4px solid #2a2a2a',
            borderTopColor: '#F6B221',
            animation: 'notchSpin 0.9s linear infinite',
          }} />
          <p style={{ color: '#ffffff', fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
            Waiting for transaction confirmation...
          </p>
          <p style={{ color: '#ffffff', fontSize: '0.95rem', margin: 0 }}>
            Do not close this screen
          </p>
          <p style={{ color: '#888888', fontSize: '0.8rem', margin: 0 }}>
            Confirm the 0.1 NIM payment in your wallet
          </p>
        </div>
      )}

      {phase === 'success' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: '#000000',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}>
          <style>{`
            @keyframes popIn {
              0% { transform: scale(0.4); opacity: 0; }
              60% { transform: scale(1.15); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'rgba(34, 197, 94, 0.15)',
            animation: 'popIn 0.4s ease',
          }}>
            <Check size={36} style={{ color: '#22c55e' }} strokeWidth={3} />
          </span>
          <p style={{ color: '#ffffff', fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            Market created!
          </p>
        </div>
      )}

      {criticalError && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid #ef4444',
            borderRadius: '12px',
            padding: '20px',
            maxWidth: '400px',
            width: '100%',
          }}>
            <p style={{ color: '#ffffff', fontWeight: 700, fontSize: '1rem', margin: '0 0 8px 0' }}>
              Market created on-chain but failed to save.
            </p>
            <p style={{ color: '#888888', fontSize: '0.85rem', margin: '0 0 8px 0', lineHeight: 1.5 }}>
              Contact support with tx hash:
            </p>
            <p style={{ color: '#fff', fontSize: '0.8rem', wordBreak: 'break-all', margin: '0 0 8px 0' }}>
              {criticalError.txHash}
            </p>
            <p style={{ color: '#888888', fontSize: '0.8rem', wordBreak: 'break-all', margin: '0 0 16px 0' }}>
              {criticalError.message}
            </p>
            <button
              onClick={() => setCriticalError(null)}
              style={{
                width: '100%',
                background: '#F6B221',
                color: '#000',
                border: 'none',
                borderRadius: '10px',
                padding: '12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Back to form
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          left: '16px',
          right: '16px',
          bottom: '80px',
          zIndex: 999998,
          background: '#ef4444',
          color: '#ffffff',
          borderRadius: '10px',
          padding: '14px 16px',
          fontSize: '0.9rem',
          fontWeight: 600,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
