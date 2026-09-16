import { useState, useRef } from 'react'
import { Check } from 'lucide-react'

function shortenAddress(addr) {
  if (!addr || addr.length < 10) return addr || ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function AddressChip({ address, showTooltip = true }) {
  const [copied, setCopied] = useState(false)
  const timeoutRef = useRef(null)

  const handleCopy = () => {
    if (!address) return
    navigator.clipboard.writeText(address)
    setCopied(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="address-chip"
      onClick={handleCopy}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        cursor: 'pointer',
        color: 'var(--nimiq-yellow)',
        fontSize: '0.875rem',
        fontWeight: 500,
      }}
      title={showTooltip ? (copied ? 'Copied!' : 'Click to copy') : undefined}
    >
      <span>{shortenAddress(address)}</span>
      {copied && <Check size={14} />}
    </div>
  )
}
