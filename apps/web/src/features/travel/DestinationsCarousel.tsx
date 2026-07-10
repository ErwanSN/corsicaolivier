"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";

import { CarouselControls } from "./CarouselControls";
import { type Destination, destinations } from "./home-content";
import { useHorizontalCarousel } from "./use-horizontal-carousel";

function DestinationSlide({
  destination,
  index
}: Readonly<{ destination: Destination; index: number }>) {
  return (
    <article
      aria-label={`${String(index + 1)} sur ${String(destinations.length)}`}
      aria-roledescription="slide"
      className="grid shrink-0 basis-full snap-start lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]"
      role="group"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-border lg:aspect-auto lg:min-h-[480px]">
        <Image
          alt=""
          className="object-cover"
          fill
          sizes="(min-width: 1024px) 62vw, 100vw"
          src={destination.image}
        />
      </div>

      <div className="flex min-h-72 flex-col justify-center bg-surface-inverse p-6 text-white sm:p-10 lg:p-12">
        <p className="text-[13px] font-bold text-white/60 uppercase">Destination</p>
        <h3 className="mt-3 text-[32px] leading-9 font-semibold md:text-[38px] md:leading-[44px]">
          {destination.title}
        </h3>
        <p className="mt-5 max-w-xl text-[16px] leading-7 text-white/75">
          {destination.description}
        </p>
        <a
          className="focus-ring mt-7 inline-flex w-fit items-center gap-2 text-[14px] font-semibold text-white underline decoration-white/35 underline-offset-4 hover:decoration-white"
          href={destination.href}
          rel="noreferrer"
          target="_blank"
        >
          Découvrir la destination
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
    </article>
  );
}

function MobilePagination({
  activeIndex,
  onSelect
}: Readonly<{ activeIndex: number; onSelect: (index: number) => void }>) {
  return (
    <div aria-label="Choisir une destination" className="mt-5 flex justify-center gap-2 sm:hidden">
      {destinations.map((destination, index) => (
        <button
          aria-current={activeIndex === index ? "true" : undefined}
          aria-label={`Afficher ${destination.title}`}
          className="focus-ring size-2.5 rounded-full bg-border transition data-[active=true]:bg-brand"
          data-active={activeIndex === index}
          key={destination.href}
          onClick={() => {
            onSelect(index);
          }}
          type="button"
        />
      ))}
    </div>
  );
}

export function DestinationsCarousel() {
  const { carouselState, scrollByOneItem, scrollToItem, trackRef, updateCarouselState } =
    useHorizontalCarousel(destinations.length, "destinations");

  return (
    <section
      aria-labelledby="destinations-heading"
      className="scroll-mt-20 bg-surface py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <h2
            className="text-[30px] leading-9 font-semibold text-foreground md:text-[38px] md:leading-[44px]"
            id="destinations-heading"
          >
            Nos destinations
          </h2>
          <div className="hidden sm:block">
            <CarouselControls
              canScrollNext={carouselState.canScrollNext}
              canScrollPrevious={carouselState.canScrollPrevious}
              onNext={() => {
                scrollByOneItem(1);
              }}
              onPrevious={() => {
                scrollByOneItem(-1);
              }}
            />
          </div>
        </div>

        <div
          aria-label="Destinations desservies"
          aria-roledescription="carrousel"
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onScroll={updateCarouselState}
          ref={trackRef}
          role="region"
        >
          {destinations.map((destination, index) => (
            <DestinationSlide destination={destination} index={index} key={destination.href} />
          ))}
        </div>

        <MobilePagination activeIndex={carouselState.activeIndex} onSelect={scrollToItem} />
        <p className="sr-only" aria-live="polite">
          Destination {carouselState.activeIndex + 1} sur {destinations.length}
        </p>
      </div>
    </section>
  );
}
