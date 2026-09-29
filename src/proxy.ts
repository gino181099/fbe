import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Chequeo optimista: sin sesión → /login. Si hay sesión, la página de login
// consulta la base (un usuario borrado conserva su cookie hasta que expira) y
// los permisos por módulo se validan en cada página y server action
// (src/lib/permissions.ts).
export default auth((req) => {
  if (!req.auth && !req.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:png|svg|jpg|jpeg|ico|webp)$).*)"],
};
