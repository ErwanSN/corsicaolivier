import { CompanyIntro } from "../../features/travel/CompanyIntro";
import { DestinationsCarousel } from "../../features/travel/DestinationsCarousel";
import { Hero } from "../../features/travel/Hero";
import { OffersCarousel } from "../../features/travel/OffersCarousel";
import { PracticalSection } from "../../features/travel/PracticalSection";
import { TestimonialsSection } from "../../features/travel/TestimonialsSection";

export default function Page() {
  return (
    <>
      <Hero />
      <OffersCarousel />
      <DestinationsCarousel />
      <PracticalSection />
      <TestimonialsSection />
      <CompanyIntro />
    </>
  );
}
