import { NextResponse, type NextRequest } from "next/server";
import { canAccessPath } from "@/lib/auth/permissions";
import { AUTH_COOKIE, getSecret, inspectSession } from "@/lib/auth/session";

const PUBLIC = new Set(["/login", "/api/auth/login", "/api/auth/logout", "/api/auth/demo", "/api/otel/v1/metrics", "/api/otel/v1/logs"]);

// 미들웨어는 화면 이동을 빨리 막는 UX 장치다. 계정 비활성화·역할 변경은 각 API 의 requireUser 가 DB 로 다시 확인한다.
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.has(pathname)) return NextResponse.next();

  const isApi = pathname.startsWith("/api/");
  const check = await inspectSession(req.cookies.get(AUTH_COOKIE)?.value, getSecret());
  if (!check.session) {
    // 로그인 직후 로그인 화면으로 되돌아올 때 원인(쿠키 미전송·서명 불일치·런타임 오류)을 서버 터미널만 보고 가를 수 있게 한다.
    console.warn(`[auth] ${req.method} ${pathname} 미인증: ${check.reason}${check.error ? ` (${check.error})` : ""}`);
    if (isApi) {
      const error = { code: "UNAUTHENTICATED", message: "로그인이 필요합니다.", details: { reason: check.reason } };
      return NextResponse.json({ error }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (!canAccessPath(check.session.role, pathname)) {
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
