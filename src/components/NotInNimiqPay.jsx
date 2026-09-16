export default function NotInNimiqPay() {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '16px',
      padding: '24px',
      zIndex: 9999,
      textAlign: 'center',
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: '#F6B221',
      }} />
      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 700,
        color: '#ffffff',
        margin: 0,
      }}>
        Open in Nimiq Pay
      </h1>
      <p style={{
        fontSize: '0.9rem',
        color: '#888888',
        margin: 0,
        maxWidth: '280px',
        lineHeight: 1.5,
      }}>
        Notch runs inside the Nimiq Pay app
      </p>
    </div>
  )
}
