import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { NimiqProvider } from './context/NimiqContext.jsx'
import App from './App.jsx'

createRoot(document.getElementById('app')).render(
  React.createElement(
    BrowserRouter,
    null,
    React.createElement(NimiqProvider, null, React.createElement(App))
  )
)
