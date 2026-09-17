// Shared Nimiq transaction signer for Supabase Edge Functions.
//
// Signs locally with the house keypair (private key never leaves the
// function environment) and broadcasts the raw transaction via public
// JSON-RPC. No funds move unless HOUSE_WALLET_PRIVATE_KEY is set.
//
// Env:
//   NIMIQ_RPC_URL  JSON-RPC endpoint (default: https://rpc.nimiqwatch.com)
//   NIMIQ_NETWORK  'main' (default) or 'test'

const RPC_URL = Deno.env.get('NIMIQ_RPC_URL') || 'https://rpc.nimiqwatch.com'
const NETWORK = (Deno.env.get('NIMIQ_NETWORK') || 'main').toLowerCase()
const STANDARD_FEE_LUNA = 138

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(
      `Nimiq RPC ${method} failed: ${data.error.message || JSON.stringify(data.error)}`
    )
  }
  return data.result as T
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function sendNimiqTransaction(
  senderAddress: string,
  senderPrivateKey: string,
  recipientAddress: string,
  amountLuna: number,
  memo: string
): Promise<string> {
  if (!Number.isInteger(amountLuna) || amountLuna < 1) {
    throw new Error(`Invalid amountLuna: ${amountLuna}`)
  }

  const Nimiq = await import('https://esm.sh/@nimiq/core-web@1.6.4')
  await Nimiq.default.load()

  const keyPair = Nimiq.default.KeyPair.fromHex(senderPrivateKey)

  // Best-effort guard: the configured address must match the private key.
  try {
    const derived = keyPair.publicKey.toAddress().toUserFriendlyAddress().replace(/ /g, '')
    if (derived !== senderAddress.replace(/ /g, '')) {
      throw new Error(
        `HOUSE_WALLET_ADDRESS does not match HOUSE_WALLET_PRIVATE_KEY (derived ${derived})`
      )
    }
  } catch (e: any) {
    if (/does not match/.test(e?.message || '')) throw e
    console.warn('[nimiqSigner] address check skipped:', e?.message || e)
  }

  const recipient = Nimiq.default.Address.fromString(recipientAddress)
  const blockHeight = await rpc<number>('getBlockNumber')
  const networkId =
    NETWORK === 'test'
      ? Nimiq.default.NetworkId.TestAlbatross
      : Nimiq.default.NetworkId.MainAlbatross

  const tx = new Nimiq.default.BasicTransaction(
    keyPair.publicKey,
    recipient,
    amountLuna,
    STANDARD_FEE_LUNA,
    blockHeight,
    networkId
  )

  const memoBytes = new TextEncoder().encode(memo || '')
  if (memoBytes.length > 0) {
    tx.data = memoBytes
  }

  const signature = Nimiq.default.Signature.create(
    keyPair.privateKey,
    keyPair.publicKey,
    tx.serializeContent()
  )
  tx.signature = signature

  const rawTx = toHex(tx.serialize())
  return await rpc<string>('sendRawTransaction', [rawTx])
}
