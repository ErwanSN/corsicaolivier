import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TripSearchBar } from "./TripSearchBar";

describe("TripSearchBar", () => {
  it("offers only destinations that perform a real navigation", () => {
    render(<TripSearchBar />);
    expect(screen.getByRole("link", { name: /Réserver sur le site officiel/ })).toHaveAttribute(
      "href",
      "https://www.corsicalinea.com"
    );
    expect(screen.getByRole("link", { name: /Consulter la carte du port/ })).toHaveAttribute(
      "href",
      "/port"
    );
    expect(screen.queryByRole("button", { name: "Rechercher" })).not.toBeInTheDocument();
  });
});
