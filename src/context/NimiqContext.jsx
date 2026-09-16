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

  useEffect(() => {
    let cancelled = false

    async function initNimiq() {
      setIsLoading(true)
      try {
        const p = await init()
        if (cancelled) return
        setProvider(p)
        const accounts = await p.listAccounts()
        const addr = Array.isArray(accounts) && accounts.length > 0 ? accounts[0] : null
        if (cancelled) return
        setAddress(addr)
        setIsConnected(true)
      } catch (e) {
        if (cancelled) return
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

  return (
    <NimiqContext.Provider value={{
      address,
      isConnected,
      isLoading,
      error,
      sendBet,
      signMessage,
      getDeviceId,
    }}>
      {children}
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
