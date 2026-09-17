export function getProbability(nimA, nimB) {
  const a = Number(nimA) || 0
  const b = Number(nimB) || 0
  const total = a + b
  if (total === 0) return { a: 50, b: 50 }
  return {
    a: Math.round((a / total) * 100),
    b: Math.round((b / total) * 100),
  }
}

export function getTimeRemaining(endsAt) {
  const end = new Date(endsAt).getTime()
  const now = Date.now()
  const diffMs = end - now

  if (Number.isNaN(end) || diffMs <= 0) {
    return { display: 'CLOSED', isUrgent: false, isClosed: true }
  }

  const totalMinutes = Math.floor(diffMs / 60000)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)

  let display
  if (days >= 1) {
    display = `${days}d ${totalHours % 24}h`
  } else if (totalHours >= 1) {
    display = `${totalHours}h ${totalMinutes % 60}m`
  } else if (totalMinutes >= 1) {
    display = `${totalMinutes}m`
  } else {
    display = `${Math.max(1, Math.floor(diffMs / 1000))}s`
  }

  return { display, isUrgent: diffMs < 3600000, isClosed: false }
}

export function formatNim(amount) {
  const n = Number(amount) || 0
  if (n >= 1000) {
    const k = Math.round((n / 1000) * 10) / 10
    return `${String(k).replace(/\.0$/, '')}k NIM`
  }
  const rounded = Math.round(n * 10) / 10
  return `${String(rounded).replace(/\.0$/, '')} NIM`
}
