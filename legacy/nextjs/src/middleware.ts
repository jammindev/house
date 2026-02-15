// nextjs/src/middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
    // 1) Laisse Supabase mettre à jour la session + cookies
    const res = await updateSession(request)

    // 2) Pose un cookie 'locale' si absent, SANS recréer une nouvelle Response
    const hasLocale = request.cookies.get('locale')?.value
    if (!hasLocale) {
        const lang = request.headers.get('accept-language')?.split(',')[0]?.toLowerCase() ?? 'en'
        const detected = lang.startsWith('fr') ? 'fr' : 'en'
        res.cookies.set('locale', detected, { path: '/', maxAge: 60 * 60 * 24 * 365 })
    }

    return res
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}