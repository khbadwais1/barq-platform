/** خطأ قاعدة عمل يُعرض للمستخدم كما هو */
export class DomainError extends Error {
  constructor(
    message: string,
    public code: string = "DOMAIN",
    public status: number = 400,
  ) {
    super(message);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "ليس لديك صلاحية لهذا الإجراء") {
    super(message, "FORBIDDEN", 403);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "يجب تسجيل الدخول") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class NotFoundError extends DomainError {
  constructor(message = "السجل غير موجود") {
    super(message, "NOT_FOUND", 404);
  }
}

export function isUniqueViolation(e: unknown, field?: string): boolean {
  const err = e as { code?: string; meta?: { target?: string[] | string } };
  if (err?.code !== "P2002") return false;
  if (!field) return true;
  const t = err.meta?.target;
  return Array.isArray(t) ? t.includes(field) : typeof t === "string" ? t.includes(field) : true;
}
