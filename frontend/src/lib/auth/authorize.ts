import { Role } from "@/generated/prisma/client";

const ROLE_HIERARCHY: Record<Role, number> = {
  member: 0,
  manager: 1,
  admin: 2,
  owner: 3,
};

const PERMISSIONS: Record<string, Record<string, Role[]>> = {
  dashboard: {
    read: ["member", "manager", "admin", "owner"],
  },
  agents: {
    read: ["member", "manager", "admin", "owner"],
    create: ["manager", "admin", "owner"],
    update: ["manager", "admin", "owner"],
    delete: ["admin", "owner"],
  },
  missions: {
    read: ["member", "manager", "admin", "owner"],
    create: ["manager", "admin", "owner"],
    update: ["manager", "admin", "owner"],
    delete: ["admin", "owner"],
  },
  analytics: {
    read: ["manager", "admin", "owner"],
  },
  settings: {
    read: ["admin", "owner"],
    update: ["admin", "owner"],
  },
  billing: {
    read: ["admin", "owner"],
    update: ["owner"],
  },
  members: {
    read: ["member", "manager", "admin", "owner"],
    invite: ["admin", "owner"],
    remove: ["admin", "owner"],
    update_role: ["owner"],
  },
  integrations: {
    read: ["member", "manager", "admin", "owner"],
    create: ["admin", "owner"],
    delete: ["admin", "owner"],
  },
  admin: {
    read: ["admin", "owner"],
  },
};

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

export function authorize(role: Role, resource: string, action: string): void {
  const allowedRoles = PERMISSIONS[resource]?.[action];
  if (!allowedRoles?.includes(role)) {
    throw new AuthorizationError(
      `Role '${role}' cannot '${action}' on '${resource}'`
    );
  }
}

export function hasPermission(
  role: Role,
  resource: string,
  action: string
): boolean {
  const allowedRoles = PERMISSIONS[resource]?.[action];
  return allowedRoles?.includes(role) ?? false;
}

export function isAtLeast(role: Role, minimum: Role): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
}
