import { describe, expect, it } from "vitest";
import { getRoleRedirect } from "./RoleRedirect";
import { type WebAuthSession } from "./web-auth-session";

const session = (role: "USER" | "EMPLOYEE" | "ADMIN"): WebAuthSession => ({
  user: {
    createdAt: "2026-07-12T00:00:00.000Z",
    email: `${role.toLowerCase()}@test.fr`,
    id: role,
    role,
    username: role
  }
});

describe("role routing", () => {
  it("keeps the client website as the default journey", () => {
    expect(getRoleRedirect("/", "authenticated", session("EMPLOYEE"))).toBeNull();
    expect(getRoleRedirect("/compte", "authenticated", session("ADMIN"))).toBeNull();
  });
  it("protects the dedicated staff journey", () => {
    expect(getRoleRedirect("/salarie/rechercher", "anonymous", null)).toBe("/salarie/connexion");
    expect(getRoleRedirect("/salarie/scan", "authenticated", session("USER"))).toBe("/compte");
    expect(getRoleRedirect("/salarie/scan", "authenticated", session("EMPLOYEE"))).toBeNull();
  });
});
