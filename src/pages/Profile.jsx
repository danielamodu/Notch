import { useParams } from 'react-router-dom'

export default function Profile() {
  const { address } = useParams()

  return (
    <div style={{ padding: '16px' }}>
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginBottom: '16px',
      }}>
        Profile
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        {address === 'me' ? 'Your profile' : `Profile for ${address}`}
      </p>
    </div>
  )
}
