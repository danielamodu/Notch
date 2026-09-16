import { NavLink } from 'react-router-dom'
import { Home, Plus, User } from 'lucide-react'

const navItems = [
  { to: '/', icon: Home, label: 'Feed' },
  { to: '/create', icon: Plus, label: 'Create', isCircle: true },
  { to: '/profile/me', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: '#0a0a0a',
      borderTop: '1px solid #2a2a2a',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '10px 0',
      height: '60px',
      zIndex: 100,
    }}>
      {navItems.map(({ to, icon: Icon, label, isCircle }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: isCircle ? '48px' : '40px',
            height: isCircle ? '48px' : '40px',
            borderRadius: isCircle ? '50%' : '8px',
            background: isCircle
              ? 'var(--nimiq-yellow)'
              : 'transparent',
            color: isActive ? 'var(--nimiq-yellow)' : 'var(--text-secondary)',
            transition: 'all 0.2s ease',
            flexShrink: 0,
          })}
        >
          {({ isActive }) => (
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
          )}
        </NavLink>
      ))}
    </nav>
  )
}
