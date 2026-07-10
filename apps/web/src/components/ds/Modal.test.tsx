import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Modal } from "./Modal";

beforeAll(() => {
  Reflect.set(
    HTMLDialogElement.prototype,
    "showModal",
    function showModal(this: HTMLDialogElement): void {
      this.setAttribute("open", "");
    }
  );
  Reflect.set(HTMLDialogElement.prototype, "close", function close(this: HTMLDialogElement): void {
    this.removeAttribute("open");
  });
});

afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

describe("Modal", () => {
  it("uses the medium design-system size and restores page scrolling", () => {
    const { unmount } = render(
      <Modal onClose={vi.fn()} title="Connexion">
        <p>Contenu</p>
      </Modal>
    );

    const dialog = screen.getByRole("dialog", { name: "Connexion" });
    expect(dialog).toHaveClass("w-[min(480px,calc(100vw-32px))]");
    expect(dialog).toHaveClass("rounded-lg");
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("exposes a clear close action", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal onClose={onClose} title="Connexion">
        <p>Contenu</p>
      </Modal>
    );

    await user.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
