import { NextResponse, type NextRequest } from 'next/server'

const AUTH_PAGES = ['/login', '/signup', '/forgot-password']
const PROTECTED_PATHS = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/broadcasts', '/automations', '/settings', '/calls']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('platform_access_token')?.value

  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isProtected = PROTECTED_PATHS.some(p => pathname.startsWith(p))

  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (!token && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
