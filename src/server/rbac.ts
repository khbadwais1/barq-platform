import type { Role } from "@prisma/client";

/** الصلاحيات الدقيقة. الدور يعطي مجموعة افتراضية، ويمكن منح صلاحيات إضافية لكل مستخدم. */
export const PERMISSIONS = [
  "dashboard.owner",
  "dashboard.finance",
  "dashboard.seller",
  "customers.create",
  "customers.viewAll",
  "customers.blacklist",
  "customers.rate",
  "sales.create",
  "sales.viewAll",
  "sales.cancel",
  "rentals.create",
  "rentals.viewAll",
  "rentals.deliver",
  "rentals.return",
  "rentals.bill",
  "invoices.viewAll",
  "payments.create",
  "payments.viewAll",
  "deposits.manage",
  "expenses.create",
  "expenses.viewAll",
  "approvals.decide",
  "accounts.view",
  "accounts.manage",
  "inventory.view",
  "inventory.adjust",
  "catalog.manage",
  "catalog.price",
  "representatives.manage",
  "followups.create",
  "promissory.manage",
  "users.manage",
  "settings.manage",
  "audit.view",
  "reports.finance",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  FINANCE: [
    "dashboard.finance",
    "customers.viewAll",
    "customers.rate",
    "sales.viewAll",
    "rentals.viewAll",
    "rentals.bill",
    "invoices.viewAll",
    "payments.create",
    "payments.viewAll",
    "deposits.manage",
    "expenses.create",
    "expenses.viewAll",
    "accounts.view",
    "inventory.view",
    "followups.create",
    "promissory.manage",
    "reports.finance",
  ],
  SELLER: [
    "dashboard.seller",
    "customers.create",
    "customers.rate",
    "sales.create",
    "rentals.create",
    "rentals.deliver",
    "inventory.view",
    "followups.create",
  ],
  WAREHOUSE: ["inventory.view", "rentals.viewAll", "rentals.deliver", "rentals.return", "customers.viewAll"],
};

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "المالك",
  FINANCE: "المالية",
  SELLER: "بائع",
  WAREHOUSE: "مسؤول العدد",
};

export const ROLE_HOME: Record<Role, string> = {
  OWNER: "/owner/dashboard",
  FINANCE: "/finance/dashboard",
  SELLER: "/seller/dashboard",
  WAREHOUSE: "/rentals",
};

export interface PermissionSubject {
  role: Role;
  permissions: string[];
}

export function hasPermission(user: PermissionSubject, p: Permission): boolean {
  return ROLE_PERMISSIONS[user.role].includes(p) || user.permissions.includes(p);
}

export function permissionsOf(user: PermissionSubject): Permission[] {
  return PERMISSIONS.filter((p) => hasPermission(user, p));
}
