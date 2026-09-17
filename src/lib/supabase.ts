import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

function missingEnvStub() {
  const msg =
    'Supabase env vars missing (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Set them in your hosting dashboard and redeploy.'
  return new Proxy(
    {},
    {
      get() {
        throw new Error(msg)
      },
    }
  )
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('[Notch] Supabase env vars missing — data features will fail until they are set.')
}

export const supabase: any =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      })
    : missingEnvStub()
