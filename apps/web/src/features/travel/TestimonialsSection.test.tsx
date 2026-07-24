import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TestimonialsSection } from "./TestimonialsSection";
import { testimonials } from "./home-content";

describe("TestimonialsSection", () => {
  it("shows every review without hiding content in a carousel", () => {
    render(<TestimonialsSection />);

    expect(screen.getByRole("heading", { name: /ils ont voyagé avec nous/i })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /avis voyageurs/i })).not.toBeInTheDocument();
    for (const testimonial of testimonials) {
      expect(screen.getByText(testimonial.author)).toBeInTheDocument();
      expect(screen.getByText(`Traversée du ${testimonial.date}`)).toBeInTheDocument();
    }
  });
});
