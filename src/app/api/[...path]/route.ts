/**
 * Catch-all API proxy — forwards every /api/* request to the FastAPI backend.
 * This means the frontend can call /api/flows, /api/contacts, etc. without
 * knowing the FastAPI URL, and existing page code that used Next.js API routes
 * keeps working unchanged.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const BACKEND = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const backendPath = '/' + path.join('/')

  // Forward query string
  const url = new URL(req.url)
  const backendUrl = `${BACKEND}${backendPath}${url.search}`

  // Read JWT from cookie
  const cookieStore = await cookies()
  const token = cookieStore.get('platform_access_token')?.value

  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('content-type') || 'application/json',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let body: BodyInit | undefined
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await req.text()
  }

  try {
    const res = await fetch(backendUrl, {
      method: req.method,
      headers,
      body,
    })

    const responseBody = await res.text()
    return new NextResponse(responseBody, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    })
  } catch (err) {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 })
  }
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
