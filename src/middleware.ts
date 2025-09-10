import { createServerClient } from '@supabase/ssr';
import {
  type NextFetchEvent,
  type NextRequest,
  NextResponse,
} from 'next/server';
import createMiddleware from 'next-intl/middleware';

import { AllLocales, AppConfig } from './utils/AppConfig';

const intlMiddleware = createMiddleware({
  locales: AllLocales,
  localePrefix: AppConfig.localePrefix,
  defaultLocale: AppConfig.defaultLocale,
});

const isProtectedRoute = (pathname: string) => {
  return pathname.includes('/dashboard')
    || pathname.includes('/onboarding');
};

export default async function middleware(
  request: NextRequest,
  _: NextFetchEvent,
) {
  if (
    request.nextUrl.pathname.includes('/sign-in')
    || request.nextUrl.pathname.includes('/sign-up')
    || isProtectedRoute(request.nextUrl.pathname)
  ) {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            request.cookies.set({
              name,
              value,
              ...options,
            });
            response.cookies.set({
              name,
              value,
              ...options,
            });
          },
          remove(name: string, options: any) {
            request.cookies.set({
              name,
              value: '',
              ...options,
            });
            response.cookies.set({
              name,
              value: '',
              ...options,
            });
          },
        },
      },
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (isProtectedRoute(request.nextUrl.pathname) && !user) {
      const locale = request.nextUrl.pathname.match(/(\/.*)\/dashboard/)?.at(1) ?? '';
      const signInUrl = new URL(`${locale}/sign-in`, request.url);
      return NextResponse.redirect(signInUrl);
    }

    return intlMiddleware(request);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next|monitoring|api|trpc).*)', '/'], // Exclude API routes, tunnelRoute used in Sentry, and other static assets
};
