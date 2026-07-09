import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import { type Reflector } from "@nestjs/core";
import { type Role } from "@corsica/contracts";
import { describe, expect, it } from "vitest";

import { RolesGuard } from "./roles.guard";

function makeContext(userRole: Role | undefined): ExecutionContext {
  return {
    getClass: () => undefined,
    getHandler: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: userRole ? { role: userRole } : undefined })
    })
  } as unknown as ExecutionContext;
}

function makeGuard(requiredRoles: Role[] | undefined): RolesGuard {
  const reflector = { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe("RolesGuard", () => {
  it("allows when no role is required", () => {
    expect(makeGuard(undefined).canActivate(makeContext("USER"))).toBe(true);
  });

  it("allows when the user role is among the required roles", () => {
    expect(makeGuard(["ADMIN", "EMPLOYEE"]).canActivate(makeContext("ADMIN"))).toBe(true);
  });

  it("forbids when the user role is not allowed", () => {
    expect(() => makeGuard(["ADMIN"]).canActivate(makeContext("USER"))).toThrow(ForbiddenException);
  });

  it("forbids when there is no authenticated user", () => {
    expect(() => makeGuard(["ADMIN"]).canActivate(makeContext(undefined))).toThrow(
      ForbiddenException
    );
  });
});
