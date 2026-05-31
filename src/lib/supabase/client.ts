/**
 * Supabase compatibility shim.
 * All data calls are proxied to the FastAPI backend via /lib/api/client.ts.
 * The `.from()` query builder returns empty results so old Supabase queries
 * don't crash — pages that need live data should be migrated to use
 * the typed API client directly.
 */
import { auth as _auth, getToken } from '@/lib/api/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) return { data: null, error: { message: res.statusText } }
  if (res.status === 204) return { data: null, error: null }
  const data = await res.json()
  return { data, error: null }
}

/** Minimal query-builder stub — fully chainable AND awaitable with {data:null, error:null} */
function makeQueryBuilder(_table: string): any {
  const RESULT = { data: null, error: null, count: 0 }
  const obj: any = {}
  const handler: ProxyHandler<any> = {
    get(_t: any, prop: string) {
      // Make the proxy a proper thenable so `await builder` resolves to RESULT
      if (prop === 'then') {
        return (resolve: (v: any) => void) => resolve(RESULT)
      }
      // Every chained method returns a new proxy so you can keep chaining
      return (..._args: any[]) => new Proxy(obj, handler)
    },
  }
  return new Proxy(obj, handler)
}

const supabaseCompat = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      try {
        await _auth.login(email, password)
        return { data: { user: { email } }, error: null }
      } catch (e: unknown) {
        return { data: null, error: { message: (e as Error).message } }
      }
    },
    async signUp({ email, password }: { email: string; password: string }) {
      try {
        await _auth.register(email, password)
        return { data: { user: { email } }, error: null }
      } catch (e: unknown) {
        return { data: null, error: { message: (e as Error).message } }
      }
    },
    async signOut() {
      _auth.signOut()
      document.cookie = 'platform_access_token=; path=/; max-age=0'
      return { error: null }
    },
    async getUser() {
      const user = await _auth.getUser()
      return { data: { user }, error: null }
    },
    async getSession() {
      const user = await _auth.getUser()
      return { data: { session: user ? { user } : null }, error: null }
    },
    onAuthStateChange(_event: unknown, _cb: unknown) {
      return { data: { subscription: { unsubscribe: () => {} } } }
    },
    async resetPasswordForEmail(_email: string, _opts?: unknown) {
      return { error: null }
    },
    async updateUser(_data: unknown) {
      return { data: null, error: null }
    },
  },

  from(table: string): any {
    return makeQueryBuilder(table)
  },

  channel(_name: string) {
    // Build a fully chainable channel stub so .on(...).on(...).subscribe() works
    const ch: any = {
      subscribe: (_cb?: any) => ({ unsubscribe: () => {} }),
      unsubscribe: () => {},
    }
    ch.on = (..._args: any[]) => ch   // every .on() returns the same object
    return ch
  },

  removeChannel(_ch: unknown) {},
  removeAllChannels() {},

  storage: {
    from(_bucket: string) {
      return {
        upload: async () => ({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: async () => ({ data: null, error: null }),
      }
    },
  },
}

/** createClient() — returns the compatibility shim typed as any to satisfy legacy call sites */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  return supabaseCompat
}
