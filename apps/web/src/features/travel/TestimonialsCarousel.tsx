"use client";

import { Quote } from "lucide-react";

import { CarouselControls } from "./CarouselControls";
import { testimonials } from "./home-content";
import { useHorizontalCarousel } from "./use-horizontal-carousel";

export function TestimonialsCarousel() {
  const { carouselState, scrollByOneItem, trackRef, updateCarouselState } = useHorizontalCarousel(
    testimonials.length,
    "testimonials"
  );
  const showNext = () => {
    scrollByOneItem(1);
  };
  const showPrevious = () => {
    scrollByOneItem(-1);
  };

  return (
    <section
      aria-labelledby="testimonials-heading"
      className="scroll-mt-20 bg-surface-inverse py-16 text-white md:py-20"
    >
      <div className="mx-auto w-full max-w-5xl px-4 lg:px-8">
        <div className="flex items-end justify-between gap-6">
          <div>
            <Quote aria-hidden="true" className="mb-5 size-8 text-brand" />
            <h2
              className="text-[30px] leading-9 font-semibold md:text-[38px] md:leading-[44px]"
              id="testimonials-heading"
            >
              Des expériences partagées
            </h2>
          </div>
          <div className="hidden sm:block">
            <CarouselControls
              canScrollNext={carouselState.canScrollNext}
              canScrollPrevious={carouselState.canScrollPrevious}
              onNext={showNext}
              onPrevious={showPrevious}
              tone="dark"
            />
          </div>
        </div>

        <div
          aria-label="Avis voyageurs"
          aria-roledescription="carrousel"
          className="mt-10 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={updateCarouselState}
          ref={trackRef}
          role="region"
          // A scrollable region must be focusable so keyboard users can pan it.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
        >
          {testimonials.map((testimonial, index) => (
            <figure
              aria-label={`${String(index + 1)} sur ${String(testimonials.length)}`}
              aria-roledescription="slide"
              className="flex min-h-64 shrink-0 basis-full snap-start flex-col justify-between pr-3"
              key={testimonial.author}
              role="group"
            >
              <blockquote className="max-w-4xl text-[23px] leading-8 font-medium text-white sm:text-[28px] sm:leading-10">
                « {testimonial.quote} »
              </blockquote>
              <figcaption className="mt-8 border-t border-white/15 pt-5">
                <span className="text-[15px] font-semibold">{testimonial.author}</span>
                <span className="ml-3 text-[13px] text-white/55">
                  Traversée du {testimonial.date}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between sm:hidden">
          <span className="text-[13px] font-semibold text-white/55">
            {String(carouselState.activeIndex + 1).padStart(2, "0")} /{" "}
            {String(testimonials.length).padStart(2, "0")}
          </span>
          <CarouselControls
            canScrollNext={carouselState.canScrollNext}
            canScrollPrevious={carouselState.canScrollPrevious}
            onNext={showNext}
            onPrevious={showPrevious}
            tone="dark"
          />
        </div>

        <p className="mt-8 text-[12px] text-white/55">
          Avis collectés par un organisme indépendant
        </p>
        <p className="sr-only" aria-live="polite">
          Avis {carouselState.activeIndex + 1} sur {testimonials.length}
        </p>
      </div>
    </section>
  );
}
