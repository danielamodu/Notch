import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk'

const HOUSE_WALLET_ADDRESS = import.meta.env.VITE_HOUSE_WALLET_ADDRESS

const NimiqContext = createContext(null)

export function NimiqProvider({ children }) {
  const [address, setAddress] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [provider, setProvider] = useState(null)
  const [status, setStatus] = useState('starting init...')
  const [accountsRaw, setAccountsRaw] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function initNimiq() {
      setIsLoading(true)
      try {
        setStatus('calling init() — waiting for window.nimiq injection...')
        const p = await init()
        if (cancelled) return
        setProvider(p)
        setStatus('init() resolved — calling listAccounts()...')
        const accounts = await p.listAccounts()
        if (cancelled) return
        setAccountsRaw(accounts)
        setStatus('listAccounts() resolved')
        const addr = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null
        if (cancelled) return
        setAddress(addr)
        setIsConnected(true)
        if (!addr) {
          setStatus('init succeeded but no accounts returned (empty array)')
        }
      } catch (e) {
        if (cancelled) return
        console.error('[Nimiq SDK init error]', e)
        setStatus('init FAILED — see error below')
        setError(e)
        setIsConnected(false)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    initNimiq()

    return () => { cancelled = true }
  }, [])

  const sendBet = useCallback(async (marketId, side, amountNim, txMemo) => {
    if (!provider || !isConnected) {
      throw new Error('Nimiq provider not connected')
    }

    const amountLunas = Math.round(amountNim * 100000)
    const data = JSON.stringify({ marketId, side, txMemo })

    const result = await provider.sendBasicTransactionWithData({
      recipient: HOUSE_WALLET_ADDRESS,
      value: amountLunas,
      data: txMemo || data,
    })

    if (result && typeof result === 'object' && result.error) {
      throw new Error(result.error.message || 'Transaction failed')
    }

    return result
  }, [provider, isConnected])

  const sendTransaction = useCallback(async (amountNim, memo) => {
    if (!provider || !isConnected) {
      throw new Error('Nimiq provider not connected')
    }
    if (!HOUSE_WALLET_ADDRESS) {
      throw new Error('House wallet address is not configured')
    }

    const amountLunas = Math.round(amountNim * 100000)

    const result = await provider.sendBasicTransactionWithData({
      recipient: HOUSE_WALLET_ADDRESS,
      value: amountLunas,
      data: memo,
    })

    if (result && typeof result === 'object' && result.error) {
      throw new Error(result.error.message || 'Transaction failed')
    }

    const hash = typeof result === 'string'
      ? result
      : (result?.hash || result?.txHash || result?.transactionHash || JSON.stringify(result))

    return { hash, raw: result }
  }, [provider, isConnected])

  const signMessage = useCallback(async (message) => {
    if (!provider || !isConnected) {
      throw new Error('Nimiq provider not connected')
    }

    const result = await provider.sign(message)

    if (result && typeof result === 'object' && result.error) {
      throw new Error(result.error.message || 'Signing failed')
    }

    return result
  }, [provider, isConnected])

  const getDeviceId = useCallback(async () => {
    const deviceId = await requestDeviceIdentifier({
      reason: 'Identify your device for Notch leaderboard and stats',
    })
    return deviceId
  }, [])

  const debug = {
    status,
    isLoading,
    isConnected,
    address: address || '(none)',
    accountsRaw: accountsRaw === null ? '(not fetched yet)' : JSON.stringify(accountsRaw),
    hasWindowNimiq: typeof window !== 'undefined' && !!window.nimiq,
    hasNimiqPay: typeof window !== 'undefined' && !!window.nimiqPay,
    href: typeof window !== 'undefined' ? window.location.href : '(no window)',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '(no navigator)',
  }

  return (
    <NimiqContext.Provider value={{
      address,
      isConnected,
      isLoading,
      error,
      sendBet,
      sendTransaction,
      signMessage,
      getDeviceId,
      debug,
    }}>
      {children}
      {error && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: '#000',
            color: '#fff',
            fontSize: '22px',
            lineHeight: '1.5',
            padding: '24px',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            zIndex: 999999,
            overflowY: 'auto',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '16px', fontSize: '26px' }}>
            Nimiq SDK init error:
          </div>
          <div>{error?.message || String(error)}</div>
          {error?.stack && (
            <div style={{ marginTop: '16px', fontSize: '16px', opacity: 0.9 }}>
              {error.stack}
            </div>
          )}
          <div style={{ marginTop: '24px', borderTop: '2px solid #fff', paddingTop: '16px', fontSize: '18px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Diagnostics:</div>
            {Object.entries(debug).map(([k, v]) => (
              <div key={k}><span style={{ opacity: 0.7 }}>{k}: </span>{String(v)}</div>
            ))}
          </div>
        </div>
      )}
    </NimiqContext.Provider>
  )
}

export function useNimiq() {
  const ctx = useContext(NimiqContext)
  if (!ctx) {
    throw new Error('useNimiq must be used within a NimiqProvider')
  }
  return ctx
}
