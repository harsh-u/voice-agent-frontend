/**
 * Server-side Supabase compatibility shim.
 * Returns the same any-typed stub as the client shim so all .from()/.auth
 * chains compile without errors.
 */
import { cookies } from 'next/headers'

// Minimal query-builder — chainable and awaitable with {data:null, error:null}
function makeQueryBuilder(_table: string): any {
  const RESULT = { data: null, error: null, count: 0 }
  const obj: any = {}
  const handler: ProxyHandler<any> = {
    get(_t: any, prop: string) {
      if (prop === 'then') {
        return (resolve: (v: any) => void) => resolve(RESULT)
      }
      return (..._args: any[]) => new Proxy(obj, handler)
    },
  }
  return new Proxy(obj, handler)
}

export async function createClient(): Promise<any> {
  const cookieStore = await cookies()
  const token = cookieStore.get('platform_access_token')?.value
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  return {
    auth: {
      async getUser() {
        if (!token) return { data: { user: null }, error: null }
        try {
          const res = await fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          })
          if (!res.ok) return { data: { user: null }, error: null }
          const user = await res.json()
          return { data: { user }, error: null }
        } catch {
          return { data: { user: null }, error: null }
        }
      },
      async signOut() { return { error: null } },
      async updateUser(_data: unknown) { return { data: null, error: null } },
    },

    from(table: string): any {
      return makeQueryBuilder(table)
    },

    channel(_name: string) {
      return {
        on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        subscribe: () => ({ unsubscribe: () => {} }),
        unsubscribe: () => {},
      }
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
}
