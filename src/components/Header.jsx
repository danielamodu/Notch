import AddressChip from './AddressChip.jsx'
import { useNimiq } from '../context/NimiqContext.jsx'

export default function Header() {
  const { address } = useNimiq()

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '56px',
      background: '#0a0a0a',
      borderBottom: '1px solid #2a2a2a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 16px',
      zIndex: 100,
    }}>
      <h1 style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: '#ffffff',
        margin: 0,
      }}>
        Notch
      </h1>
      {address ? (
        <AddressChip address={address} />
      ) : (
        <span style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
        }}>
          Not connected
        </span>
      )}
    </header>
  )
}
