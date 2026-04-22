import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const UI_LANG_HEADER = "x-ui-lang";

function uiLangFromRequest(request: NextRequest): "es" | "en" {
  return request.nextUrl.searchParams.get("lang") === "en" ? "en" : "es";
}

export function proxy(request: NextRequest) {
  const lang = uiLangFromRequest(request);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(UI_LANG_HEADER, lang);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
