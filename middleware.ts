import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // The old get/set/remove pattern reassigned `response = NextResponse.next(...)`
  // on every cookie write, which wipes any Set-Cookie headers added by a previous
  // call. Supabase writes the access + refresh tokens as separate chunked cookies
  // during session refresh, so only the last cookie reached the browser, leaving
  // the session permanently broken on the next request. The getAll/setAll pattern
  // writes every cookie atomically onto a single response object.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/me/:path*",
    "/book/:path*",
    "/listener/:path*",
    "/chat/:path*",
    "/api/:path*",
  ],
};
