import { render, screen } from "@testing-library/react";
import { type Role } from "@corsica/contracts";
import { describe, expect, it, vi } from "vitest";

import { AccountDetails } from "./AccountDetails";
import { type WebAuthSession } from "../auth/web-auth-session";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../auth/use-stored-auth-session", () => ({
  useStoredAuthSession: () => ({ clearSession: vi.fn() })
}));

function sessionFor(role: Role): WebAuthSession {
  return {
    user: {
      createdAt: "2026-07-10T00:00:00.000Z",
      email: `${role.toLowerCase()}@example.test`,
      id: "1e20ad5e-87cd-4d6a-9cb5-03090a6ed0df",
      role,
      username: role.toLowerCase()
    }
  };
}

describe("AccountDetails role experience", () => {
  it("allows a client to change their password directly", () => {
    render(<AccountDetails session={sessionFor("USER")} variant="client" />);
    expect(screen.getByRole("heading", { name: "Compte client" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Modifier mon mot de passe/ })).toBeInTheDocument();
    expect(screen.queryByText("Administration")).not.toBeInTheDocument();
  });

  it("requires an employee password request", () => {
    render(<AccountDetails session={sessionFor("EMPLOYEE")} variant="staff" />);
    expect(screen.getByRole("heading", { name: "Compte employé" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Demander un nouveau mot de passe/ })
    ).toBeInTheDocument();
  });

  it("exposes administration tools only to administrators", () => {
    render(<AccountDetails session={sessionFor("ADMIN")} variant="staff" />);
    expect(screen.getByRole("heading", { name: "Compte administrateur" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Administrer la carte du port/ })).toHaveAttribute(
      "href",
      "/port/admin"
    );
  });
});
