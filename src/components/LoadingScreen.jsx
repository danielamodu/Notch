export default function LoadingScreen({ status = '' }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '24px',
      zIndex: 9999,
      padding: '24px',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 700,
        color: '#ffffff',
        letterSpacing: '-0.5px',
      }}>
        Notch
      </h1>
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: '#F6B221',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      {status && (
        <p style={{ color: '#ffffff', fontSize: '16px', maxWidth: '320px', lineHeight: 1.5 }}>
          {status}
        </p>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  )
}
