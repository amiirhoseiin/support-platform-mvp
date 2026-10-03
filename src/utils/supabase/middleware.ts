import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim().replace(/\/rest\/v1\/?$/, '');
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Fetch the authenticated user securely
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isCustomerRoute = pathname.startsWith('/customer');
  const isStaffRoute = pathname.startsWith('/agent') || pathname.startsWith('/founder');
  const isLoginRoute = pathname === '/login';

  const copyCookies = (target: NextResponse) => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      target.cookies.set(cookie);
    });
    return target;
  };

  // Unauthenticated user attempting to access protected routes
  if (!user && (isCustomerRoute || isStaffRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return copyCookies(NextResponse.redirect(url));
  }

  // Authenticated user
  if (user) {
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role;

    // Customer route protection: requires role === 'customer'
    if (isCustomerRoute && role !== 'customer') {
      const url = request.nextUrl.clone();
      url.pathname = role === 'agent' || role === 'founder' ? '/agent' : '/login';
      return copyCookies(NextResponse.redirect(url));
    }

    // Agent/Founder route protection: requires role === 'agent' or 'founder'
    if (isStaffRoute && role !== 'agent' && role !== 'founder') {
      const url = request.nextUrl.clone();
      url.pathname = role === 'customer' ? '/customer' : '/login';
      return copyCookies(NextResponse.redirect(url));
    }

    // Logged in user visiting /login
    if (isLoginRoute) {
      const url = request.nextUrl.clone();
      url.pathname = role === 'customer' ? '/customer' : '/agent';
      return copyCookies(NextResponse.redirect(url));
    }
  }

  return supabaseResponse;
}

