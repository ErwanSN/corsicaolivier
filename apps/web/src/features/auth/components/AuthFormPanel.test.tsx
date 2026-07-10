import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { AuthFormPanel } from "./AuthFormPanel";

describe("AuthFormPanel", () => {
  it("submits normalized sign-in form values through the public contract", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(createElement(AuthFormPanel, { mode: "signIn", onSubmit }));

    await user.type(screen.getByLabelText("Email ou nom d'utilisateur"), "agent@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Se connecter" }));

    expect(onSubmit).toHaveBeenCalledWith({
      identifier: "agent@example.com",
      password: "correct-horse-battery"
    });
  });

  it("exposes password-policy failures as an accessible alert", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(createElement(AuthFormPanel, { mode: "createAccount", onSubmit }));

    await user.type(screen.getByLabelText("Email"), "client@example.com");
    await user.type(screen.getByLabelText("Mot de passe"), "court");
    await user.click(screen.getByRole("button", { name: "Créer un compte" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
