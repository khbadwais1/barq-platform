import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, UnauthorizedError } from "./errors";
import { hasPermission, type Permission } from "./rbac";
import type { Role } from "@prisma/client";

export const SESSION_COOKIE = "barq_session";
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES ?? 60);
const MAX_HOURS = Number(process.env.SESSION_MAX_HOURS ?? 12);
const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  role: Role;
  permissions: string[];
  mustChangePassword: boolean;
  representativeId: string | null;
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

async function clientInfo() {
  const h = await headers();
  return {
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  };
}

export type LoginResult = { ok: true; role: Role; mustChangePassword: boolean } | { ok: false; error: string };

export async function login(usernameRaw: string, password: string): Promise<LoginResult> {
  const username = usernameRaw.trim().toLowerCase();
  const { ip, userAgent } = await clientInfo();
  const user = await prisma.user.findUnique({ where: { username } });
  const fail = async (reason: string, msg = "اسم المستخدم أو كلمة المرور غير صحيحة") => {
    await prisma.loginAttempt.create({ data: { username, userId: user?.id, success: false, reason, ip, userAgent } });
    return { ok: false as const, error: msg };
  };
  if (!user) return fail("UNKNOWN_USER");

  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const recentFails = await prisma.loginAttempt.count({
    where: { username, success: false, createdAt: { gte: since }, reason: { not: "LOCKED" } },
  });
  const lastSuccess = await prisma.loginAttempt.findFirst({
    where: { username, success: true, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
  });
  const failsAfterSuccess = lastSuccess
    ? await prisma.loginAttempt.count({
        where: { username, success: false, createdAt: { gt: lastSuccess.createdAt }, reason: { not: "LOCKED" } },
      })
    : recentFails;
  if (failsAfterSuccess >= MAX_FAILED) {
    return fail("LOCKED", `تم إيقاف الدخول مؤقتًا بعد ${MAX_FAILED} محاولات فاشلة. حاول بعد ${LOCK_MINUTES} دقيقة.`);
  }
  if (!user.isActive) return fail("DISABLED", "هذا الحساب معطّل. تواصل مع المالك.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return fail("BAD_PASSWORD");

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  await prisma.$transaction([
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(now.getTime() + MAX_HOURS * 3600_000),
        ip,
        userAgent,
      },
    }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
    prisma.loginAttempt.create({ data: { username, userId: user.id, success: true, ip, userAgent } }),
    prisma.auditLog.create({ data: { userId: user.id, role: user.role, action: "LOGIN", entityType: "User", entityId: user.id, ip } }),
  ]);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: MAX_HOURS * 3600,
  });
  return { ok: true, role: user.role, mustChangePassword: user.mustChangePassword };
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const s = await prisma.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (s && !s.revokedAt) {
      await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
      await prisma.auditLog.create({ data: { userId: s.userId, role: s.user.role, action: "LOGOUT", entityType: "User", entityId: s.userId } });
    }
  }
  jar.delete(SESSION_COOKIE);
}

/** المستخدم الحالي أو null. يتحقق من انتهاء الجلسة بالخمول أو بالمدة القصوى ومن تعطيل الحساب. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { representative: { select: { id: true } } } } },
  });
  if (!s || s.revokedAt) return null;
  const now = Date.now();
  if (s.expiresAt.getTime() < now || now - s.lastSeenAt.getTime() > IDLE_MINUTES * 60_000 || !s.user.isActive) {
    if (!s.revokedAt) await prisma.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } });
    return null;
  }
  if (now - s.lastSeenAt.getTime() > 60_000) {
    await prisma.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  }
  const u = s.user;
  return {
    id: u.id,
    username: u.username,
    name: u.name,
    role: u.role,
    permissions: u.permissions,
    mustChangePassword: u.mustChangePassword,
    representativeId: u.representative?.id ?? null,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}

export async function requirePermission(p: Permission): Promise<CurrentUser> {
  const u = await requireUser();
  if (!hasPermission(u, p)) throw new ForbiddenError();
  return u;
}

export function can(u: CurrentUser, p: Permission) {
  return hasPermission(u, p);
}
