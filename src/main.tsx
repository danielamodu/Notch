import { createRoot } from 'react-dom/client'
import { NimiqProvider, useNimiq } from './nimiq/NimiqContext'
import Home from './Home'
import NotchLogo from './components/NotchLogo'
import './index.css'

// Last-resort overlay: if anything crashes before/during React render,
// show it as readable text instead of a blank screen.
function showFatal(message: string) {
  try {
    let layer = document.getElementById('notch-fatal-overlay')
    if (!layer) {
      layer = document.createElement('div')
      layer.id = 'notch-fatal-overlay'
      layer.style.cssText =
        'position:fixed;inset:0;z-index:9999999;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,-apple-system,BlinkMacSystemFont,Helvetica Neue,Arial,sans-serif;'
      const scrim = document.createElement('div')
      scrim.style.cssText =
        'position:absolute;inset:0;background:rgba(23,23,23,0.45);'
      scrim.onclick = () => {
        const el = document.getElementById('notch-fatal-overlay')
        if (el) el.remove()
      }
      const card = document.createElement('div')
      card.style.cssText =
        'position:relative;width:100%;max-width:400px;background:#FFFDF9;border:1px solid #E9DED1;border-radius:20px;padding:24px 20px 20px 20px;color:#171717;max-height:80vh;overflow-y:auto;'
      const badge = document.createElement('div')
      badge.textContent = 'OOPS'
      badge.style.cssText =
        'display:inline-block;background:#FF3B3B;color:#FFF4E6;font-size:12px;font-weight:800;letter-spacing:1px;border-radius:999px;padding:4px 12px;margin-bottom:12px;'
      const title = document.createElement('div')
      title.textContent = 'Something went wrong'
      title.style.cssText = 'font-size:20px;font-weight:800;margin:0 0 8px 0;line-height:1.3;'
      const sub = document.createElement('div')
      sub.textContent = 'Give it another shot — your wallet and markets are safe.'
      sub.style.cssText = 'font-size:15px;color:#77736E;margin:0 0 16px 0;line-height:1.5;'
      const details = document.createElement('details')
      details.style.cssText = 'font-size:13px;color:#77736E;margin-bottom:16px;'
      const summary = document.createElement('summary')
      summary.textContent = 'Details'
      summary.style.cssText = 'cursor:pointer;font-weight:700;'
      const body = document.createElement('div')
      body.id = 'notch-fatal-body'
      body.style.cssText = 'margin-top:8px;white-space:pre-wrap;word-break:break-word;'
      details.appendChild(summary)
      details.appendChild(body)
      const row = document.createElement('div')
      row.style.cssText = 'display:flex;gap:10px;'
      const dismiss = document.createElement('button')
      dismiss.textContent = 'Dismiss'
      dismiss.style.cssText =
        'flex:1;background:transparent;border:1px solid #E9DED1;border-radius:12px;padding:14px;font-size:15px;font-weight:700;color:#171717;cursor:pointer;min-height:44px;'
      dismiss.onclick = () => {
        const el = document.getElementById('notch-fatal-overlay')
        if (el) el.remove()
      }
      const reload = document.createElement('button')
      reload.textContent = 'Retry'
      reload.style.cssText =
        'flex:1;background:#FF3B3B;border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;color:#FFF4E6;cursor:pointer;min-height:44px;'
      reload.onclick = () => window.location.reload()
      row.appendChild(dismiss)
      row.appendChild(reload)
      card.appendChild(badge)
      card.appendChild(title)
      card.appendChild(sub)
      card.appendChild(details)
      card.appendChild(row)
      layer.appendChild(scrim)
      layer.appendChild(card)
      document.body.appendChild(layer)
    }
    const bodyEl = document.getElementById('notch-fatal-body')
    if (bodyEl) bodyEl.textContent = message
  } catch (_) {
    /* ignore */
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    showFatal((e && (e as ErrorEvent).message) || String((e && (e as any).error) || e))
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason
    showFatal((reason && (reason.stack || reason.message)) || String(reason))
  })
}

function Gate({ children }: { children: React.ReactNode }) {
  const { address, isLoading, error, debug } = useNimiq()

  if (isLoading) {
    return (
      <div className="onboarding-layer">
        <section className="onboarding-card" aria-label="Loading Notch">
          <NotchLogo />
          <p style={{ marginTop: '16px' }}>{debug.status}</p>
        </section>
      </div>
    )
  }

  if (error || !address) {
    return (
      <div className="onboarding-layer">
        <section className="onboarding-card" aria-label="Open in Nimiq Pay">
          <NotchLogo />
          <h1>
            Open in <em>Nimiq Pay.</em>
          </h1>
          <p>Notch runs inside the Nimiq Pay app.</p>
          {error && (
            <p style={{ fontSize: '14px', opacity: 0.8, wordBreak: 'break-word' }}>
              {String((error as any)?.message || error)}
            </p>
          )}
        </section>
      </div>
    )
  }

  return <>{children}</>
}

try {
  createRoot(document.getElementById('root')!).render(
    <NimiqProvider>
      <Gate>
        <Home />
      </Gate>
    </NimiqProvider>
  )
} catch (e: any) {
  showFatal((e && e.stack) || String(e))
}
