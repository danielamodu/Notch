import { createRoot } from 'react-dom/client'
import { NimiqProvider, useNimiq } from './nimiq/NimiqContext'
import Home from './Home'
import NotchLogo from './components/NotchLogo'
import './index.css'

// Last-resort overlay: if anything crashes before/during React render,
// show it as readable text instead of a blank screen.
function showFatal(message: string) {
  try {
    let div = document.getElementById('notch-fatal-overlay')
    if (!div) {
      div = document.createElement('div')
      div.id = 'notch-fatal-overlay'
      div.style.cssText =
        'position:fixed;inset:0;background:#FFF4E6;color:#171717;font-size:20px;line-height:1.5;padding:24px;white-space:pre-wrap;word-break:break-word;overflow-y:auto;font-family:Inter,-apple-system,BlinkMacSystemFont,Helvetica Neue,Arial,sans-serif;z-index:9999999;'
      const dismiss = document.createElement('div')
      dismiss.textContent = 'TAP HERE TO DISMISS'
      dismiss.style.cssText =
        'background:#FF3B3B;color:#FFF4E6;font-weight:800;text-align:center;border-radius:12px;padding:14px;margin-bottom:16px;font-size:16px;white-space:normal;'
      dismiss.onclick = () => {
        const el = document.getElementById('notch-fatal-overlay')
        if (el) el.remove()
      }
      const body = document.createElement('div')
      body.id = 'notch-fatal-body'
      div.appendChild(dismiss)
      div.appendChild(body)
      document.body.appendChild(div)
    }
    const bodyEl = document.getElementById('notch-fatal-body')
    if (bodyEl) bodyEl.textContent = 'FATAL: ' + message
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
