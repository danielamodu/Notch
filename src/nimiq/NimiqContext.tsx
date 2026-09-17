import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import { init, requestDeviceIdentifier } from '@nimiq/mini-app-sdk'

const HOUSE_WALLET_ADDRESS = import.meta.env.VITE_HOUSE_WALLET_ADDRESS as string | undefined

type DebugInfo = Record<string, string>

interface NimiqContextValue {
  address: string | null
  isConnected: boolean
  isLoading: boolean
  error: any
  sendBet: (marketId: string, side: string, amountNim: number, txMemo?: string) => Promise<any>
  sendTransaction: (amountNim: number, memo: string) => Promise<{ hash: string; raw: any }>
  signMessage: (message: string) => Promise<any>
  getDeviceId: () => Promise<string>
  debug: DebugInfo
}

const NimiqContext = createContext<NimiqContextValue | null>(null)

function friendlyWalletMessage(raw: string): string {
  if (/not injected|nimiq app/i.test(raw)) {
    return 'Open Notch inside Nimiq Pay to connect your wallet.'
  }
  if (/empty|no accounts/i.test(raw)) {
    return 'No wallet account found. Add an account in Nimiq Pay and try again.'
  }
  return 'Something went wrong connecting your wallet. Please try again.'
}

function WalletErrorPopup({ error, debug }: { error: any; debug: DebugInfo }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null
  const raw = error?.message || String(error)
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Wallet connection issue"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(23, 23, 23, 0.45)' }}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      />
      <section
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '400px',
          background: '#FFFDF9',
          border: '1px solid #E9DED1',
          borderRadius: '20px',
          padding: '24px 20px 20px 20px',
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
          color: '#171717',
          zIndex: 1,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundColor: '#FF3B3B',
            color: '#FFF4E6',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '1px',
            borderRadius: '999px',
            padding: '4px 12px',
            marginBottom: '12px',
          }}
        >
          WALLET
        </span>
        <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', lineHeight: 1.3 }}>
          Couldn't connect your wallet
        </h2>
        <p style={{ fontSize: '15px', color: '#77736E', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          {friendlyWalletMessage(raw)}
        </p>
        <details style={{ fontSize: '13px', color: '#77736E', marginBottom: '16px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Details</summary>
          <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{raw}</div>
          {Object.entries(debug).map(([k, v]) => (
            <div key={k}>
              {k}: {String(v)}
            </div>
          ))}
        </details>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setDismissed(true)}
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid #E9DED1',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#171717',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Dismiss
          </button>
          <button
            onClick={() => window.location.reload()}
            style={{
              flex: 1,
              background: '#FF3B3B',
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '15px',
              fontWeight: 700,
              color: '#FFF4E6',
              cursor: 'pointer',
              minHeight: '44px',
            }}
          >
            Retry
          </button>
        </div>
      </section>
    </div>
  )
}

export function NimiqProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [provider, setProvider] = useState<any>(null)
  const [status, setStatus] = useState('starting init...')
  const [accountsRaw, setAccountsRaw] = useState<any>(null)

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

    return () => {
      cancelled = true
    }
  }, [])

  const sendBet = useCallback(
    async (marketId: string, side: string, amountNim: number, txMemo?: string) => {
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
    },
    [provider, isConnected]
  )

  const sendTransaction = useCallback(
    async (amountNim: number, memo: string) => {
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

      const hash =
        typeof result === 'string'
          ? result
          : result?.hash || result?.txHash || result?.transactionHash || JSON.stringify(result)

      return { hash, raw: result }
    },
    [provider, isConnected]
  )

  const signMessage = useCallback(
    async (message: string) => {
      if (!provider || !isConnected) {
        throw new Error('Nimiq provider not connected')
      }

      const result = await provider.sign(message)

      if (result && typeof result === 'object' && result.error) {
        throw new Error(result.error.message || 'Signing failed')
      }

      return result
    },
    [provider, isConnected]
  )

  const getDeviceId = useCallback(async () => {
    const deviceId = await requestDeviceIdentifier({
      reason: 'Identify your device for Notch leaderboard and stats',
    })
    return deviceId
  }, [])

  const debug: DebugInfo = {
    status,
    isLoading: String(isLoading),
    isConnected: String(isConnected),
    address: address || '(none)',
    accountsRaw: accountsRaw === null ? '(not fetched yet)' : JSON.stringify(accountsRaw),
    hasWindowNimiq: String(typeof window !== 'undefined' && !!(window as any).nimiq),
    hasNimiqPay: String(typeof window !== 'undefined' && !!(window as any).nimiqPay),
    href: typeof window !== 'undefined' ? window.location.href : '(no window)',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '(no navigator)',
  }

  return (
    <NimiqContext.Provider
      value={{
        address,
        isConnected,
        isLoading,
        error,
        sendBet,
        sendTransaction,
        signMessage,
        getDeviceId,
        debug,
      }}
    >
      {children}
      {error && (
        <WalletErrorPopup key={String(error?.message || error)} error={error} debug={debug} />
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
