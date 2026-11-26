import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getCurrentUser, type CurrentUser } from "./auth";
import { hasPermission, type Permission } from "./rbac";
import { DomainError } from "./errors";

/** للصفحات: يعيد التوجيه لصفحة الدخول، ويعرض صفحة 403 عند نقص الصلاحية */
export async function pageGuard(...anyOf: Permission[]): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (u.mustChangePassword) redirect("/profile?force=1");
  if (anyOf.length && !anyOf.some((p) => hasPermission(u, p))) redirect("/forbidden");
  return u;
}

/** لمسارات API: 401 بدون جلسة، 403 مع جلسة بلا صلاحية */
export async function apiGuard(
  ...anyOf: Permission[]
): Promise<{ user: CurrentUser; error?: undefined } | { user?: undefined; error: NextResponse }> {
  const u = await getCurrentUser();
  if (!u) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  if (anyOf.length && !anyOf.some((p) => hasPermission(u, p)))
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) };
  return { user: u };
}

export function apiError(e: unknown) {
  if (e instanceof DomainError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "خطأ غير متوقع" }, { status: 500 });
}
