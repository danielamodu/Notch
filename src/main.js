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
      document.body.appendChild(div)
    }
    div.textContent = 'FATAL: ' + message
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
