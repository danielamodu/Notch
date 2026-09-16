export default function NotInNimiqPay({ error = null, debug = null }) {
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: '#000000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: '16px',
      padding: '24px',
      zIndex: 9999,
      textAlign: 'center',
      overflowY: 'auto',
      color: '#ffffff',
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
        marginTop: '32px',
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
      {(error || debug) && (
        <div style={{
          marginTop: '16px',
          width: '100%',
          maxWidth: '600px',
          background: '#111',
          border: '1px solid #333',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'left',
          fontSize: '16px',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: '#fff',
        }}>
          {error && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontWeight: 'bold' }}>Error:</div>
              <div>{error?.message || String(error)}</div>
            </div>
          )}
          {debug && (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Diagnostics:</div>
              {Object.entries(debug).map(([k, v]) => (
                <div key={k}>
                  <span style={{ opacity: 0.6 }}>{k}: </span>{String(v)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
