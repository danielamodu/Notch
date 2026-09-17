import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { NimiqProvider } from './context/NimiqContext.jsx'
import App from './App.jsx'

// Last-resort overlay: if anything crashes before/during React render
// (e.g. bad bundle, missing env), show it as readable text instead of blank.
function showFatal(message) {
  try {
    let div = document.getElementById('notch-fatal-overlay')
    if (!div) {
      div = document.createElement('div')
      div.id = 'notch-fatal-overlay'
      div.style.cssText = 'position:fixed;inset:0;background:#000;color:#fff;font-size:22px;line-height:1.5;padding:24px;white-space:pre-wrap;word-break:break-word;overflow-y:auto;font-family:system-ui,sans-serif;z-index:9999999;'
      const dismiss = document.createElement('div')
      dismiss.textContent = 'TAP HERE TO DISMISS'
      dismiss.style.cssText = 'background:#F6B221;color:#000;font-weight:700;text-align:center;border-radius:10px;padding:12px;margin-bottom:16px;font-size:16px;white-space:normal;'
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
  } catch (_) { /* ignore */ }
}

window.addEventListener('error', (e) => {
  showFatal((e && e.message) || String((e && e.error) || e))
})
window.addEventListener('unhandledrejection', (e) => {
  const reason = e && e.reason
  showFatal((reason && (reason.stack || reason.message)) || String(reason))
})

try {
  createRoot(document.getElementById('app')).render(
    React.createElement(
      BrowserRouter,
      null,
      React.createElement(NimiqProvider, null, React.createElement(App))
    )
  )
} catch (e) {
  showFatal((e && e.stack) || String(e))
}
