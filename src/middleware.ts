import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/auth/permissions";
import { AUTH_COOKIE, getSecret, verifySession } from "@/lib/auth/session";

const PUBLIC = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/demo", "/api/otel/v1/metrics", "/api/otel/v1/logs"]);

// 미들웨어는 화면 이동을 빨리 막는 UX 장치다. 계정 비활성화·역할 변경은 각 API 의 requireUser 가 DB 로 다시 확인한다.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const session = await verifySession(req.cookies.get(AUTH_COOKIE)?.value, getSecret());
  if (!session) {
    if (isApi) return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." } }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (!canAccessPath(session.role, pathname)) {
    if (isApi) return NextResponse.json({ error: { code: "FORBIDDEN", message: "접근 권한이 없습니다." } }, { status: 403 });
    const url = req.nextUrl.clone();
    url.search = "";
    url.pathname = "/forbidden";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};
