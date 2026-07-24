import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripSearchBar } from "./TripSearchBar";

describe("TripSearchBar", () => {
  it("submits the booking search to the internal reservation route", () => {
    render(<TripSearchBar />);

    const form = screen.getByRole("search", { name: "Rechercher une traversée" });
    expect(form).toHaveAttribute("action", "/reservation");
    expect(form).toHaveAttribute("method", "get");
    expect(screen.getByRole("combobox", { name: "Traversée" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Date aller" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retour (facultatif)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeInTheDocument();
    expect(screen.queryByText(/site officiel/i)).not.toBeInTheDocument();
  });

  it("blocks an incomplete search with an actionable error", () => {
    render(<TripSearchBar />);

    fireEvent.submit(screen.getByRole("search", { name: "Rechercher une traversée" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choisissez une traversée et une date aller."
    );
  });
});
