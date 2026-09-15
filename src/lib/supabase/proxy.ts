import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnvironment } from "@/lib/validation/environment";

function redirectToAdminLogin(
  request: NextRequest,
  sessionResponse: NextResponse,
) {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.search = "";

  const redirectResponse = NextResponse.redirect(loginUrl);
  sessionResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabasePublicEnvironment();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isLoginRoute = request.nextUrl.pathname === "/admin/login";

  if (!data?.claims && !isLoginRoute) {
    return redirectToAdminLogin(request, response);
  }

  return response;
}
