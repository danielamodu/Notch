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

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0))
  let off = 0
  for (const a of arrs) {
    out.set(a, off)
    off += a.length
  }
  return out
}

async function hmacSha512(keyBytes: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, data))
}

async function bip39Seed(mnemonic: string, passphrase = ''): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(mnemonic.normalize('NFKD')),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-512',
      salt: enc.encode('mnemonic' + passphrase),
      iterations: 2048,
    },
    keyMaterial,
    512
  )
  return new Uint8Array(bits)
}

// SLIP-10 Ed25519 derivation (hardened levels only, as Ed25519 requires).
async function slip10Ed25519(seed: Uint8Array, path: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  let I = await hmacSha512(enc.encode('ed25519 seed'), seed)
  let k = I.slice(0, 32)
  let c = I.slice(32)

  const segs = path.replace(/^m\//, '').split('/')
  for (const s of segs) {
    const hardened = s.endsWith("'")
    if (!hardened) throw new Error('Only hardened derivation is supported for Ed25519 keys')
    const idx = parseInt(s.slice(0, -1), 10)
    if (!Number.isInteger(idx) || idx < 0) throw new Error(`Bad path segment: ${s}`)
    const indexBytes = new Uint8Array(4)
    new DataView(indexBytes.buffer).setUint32(0, 0x80000000 + idx)
    I = await hmacSha512(c, concatBytes(new Uint8Array([0]), k, indexBytes))
    k = I.slice(0, 32)
    c = I.slice(32)
  }
  return k
}

// Resolves the house private key (hex). Prefers HOUSE_WALLET_PRIVATE_KEY;
// otherwise derives from the 12-word HOUSE_SEED_PHRASE via BIP39 + SLIP-10
// Ed25519. The signer verifies the derived address matches
// HOUSE_WALLET_ADDRESS before sending anything, so a wrong path fails
// safe with a clear error (and the derived address to compare).
export async function resolveHousePrivateKeyHex(): Promise<{ hex: string; source: string }> {
  const raw = Deno.env.get('HOUSE_WALLET_PRIVATE_KEY')
  if (raw && raw.trim()) {
    return { hex: raw.trim().replace(/^0x/, ''), source: 'HOUSE_WALLET_PRIVATE_KEY' }
  }

  const phrase = Deno.env.get('HOUSE_SEED_PHRASE')
  if (!phrase || !phrase.trim()) {
    throw new Error('Set either HOUSE_WALLET_PRIVATE_KEY or HOUSE_SEED_PHRASE secret')
  }
  const words = phrase.trim().split(/\s+/)
  if (![12, 15, 18, 21, 24].includes(words.length)) {
    throw new Error('HOUSE_SEED_PHRASE must be 12, 15, 18, 21 or 24 words')
  }
  const seed = await bip39Seed(words.join(' '), Deno.env.get('HOUSE_SEED_PASSPHRASE') || '')
  const path = Deno.env.get('NIMIQ_DERIVATION_PATH') || "m/44'/242'/0'/0/0"
  const priv = await slip10Ed25519(seed, path)
  return { hex: toHex(priv), source: `HOUSE_SEED_PHRASE (${path})` }
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
