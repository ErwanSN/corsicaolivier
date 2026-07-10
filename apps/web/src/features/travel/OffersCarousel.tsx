"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

import { Select } from "../../components/ds/Select";
import { CarouselControls, type CarouselControlsProps } from "./CarouselControls";
import {
  type Offer,
  offerCategories,
  offerCategoryOptions,
  offerCategoryOrder,
  type OfferCategoryKey
} from "./offers";
import { useHorizontalCarousel } from "./use-horizontal-carousel";

function OfferCard({
  index,
  offer,
  total
}: Readonly<{ index: number; offer: Offer; total: number }>) {
  return (
    <article
      aria-label={`${String(index + 1)} sur ${String(total)}`}
      aria-roledescription="slide"
      className="flex h-auto shrink-0 basis-[88%] snap-start flex-col overflow-hidden rounded-lg border border-border bg-surface sm:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)]"
      role="group"
    >
      <div className="relative aspect-[49/38] overflow-hidden bg-border">
        <Image
          alt=""
          className="object-cover transition duration-300 ease-out hover:scale-[1.025]"
          fill
          sizes="(min-width: 1024px) 29vw, (min-width: 640px) 46vw, 88vw"
          src={offer.image}
        />
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[13px] leading-5 font-bold text-brand uppercase">{offer.label}</p>
        <h3 className="mt-2 text-[21px] leading-7 font-semibold text-foreground">{offer.title}</h3>
        {offer.detail ? (
          <p className="mt-1 text-[14px] leading-5 text-foreground/65">{offer.detail}</p>
        ) : null}
        <a
          className="focus-ring mt-auto inline-flex w-fit items-center gap-2 pt-6 text-[14px] font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={offer.href}
          rel="noreferrer"
          target="_blank"
        >
          En savoir plus
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
    </article>
  );
}

function CategoryPicker({
  activeCategory,
  onChange
}: Readonly<{ activeCategory: OfferCategoryKey; onChange: (value: OfferCategoryKey) => void }>) {
  return (
    <>
      <div className="mt-6 sm:hidden">
        <Select
          ariaLabel="Choisir une catégorie d'offres"
          className="w-full justify-between border border-border bg-surface"
          onValueChange={(value) => {
            onChange(value as OfferCategoryKey);
          }}
          options={offerCategoryOptions}
          placeholder="Choisir une catégorie"
          value={activeCategory}
        />
      </div>

      <div aria-label="Catégories d'offres" className="mt-7 hidden gap-7 sm:flex" role="tablist">
        {offerCategoryOrder.map((key) => (
          <button
            aria-controls="offers-carousel"
            aria-selected={activeCategory === key}
            className="focus-ring border-b-2 border-transparent pb-2 text-[14px] font-semibold text-foreground/55 transition hover:text-foreground data-[active=true]:border-brand data-[active=true]:text-foreground"
            data-active={activeCategory === key}
            key={key}
            onClick={() => {
              onChange(key);
            }}
            role="tab"
            type="button"
          >
            {offerCategories[key].label}
          </button>
        ))}
      </div>
    </>
  );
}

function MobilePagination({
  activeIndex,
  offers,
  onSelect
}: Readonly<{ activeIndex: number; offers: readonly Offer[]; onSelect: (index: number) => void }>) {
  return (
    <div aria-label="Choisir une offre" className="mt-5 flex justify-center gap-2 sm:hidden">
      {offers.map((offer, index) => (
        <button
          aria-current={activeIndex === index ? "true" : undefined}
          aria-label={`Afficher ${offer.label}`}
          className="focus-ring size-2.5 rounded-full bg-border transition data-[active=true]:bg-brand"
          data-active={activeIndex === index}
          key={offer.href}
          onClick={() => {
            onSelect(index);
          }}
          type="button"
        />
      ))}
    </div>
  );
}

function OffersHeader({
  canScrollNext,
  canScrollPrevious,
  onNext,
  onPrevious
}: CarouselControlsProps) {
  return (
    <div className="flex items-end justify-between gap-6">
      <h2
        className="max-w-2xl text-[30px] leading-9 font-semibold text-foreground md:text-[38px] md:leading-[44px]"
        id="offers-heading"
      >
        Tarifs, Offres &amp; Promotions
      </h2>
      <div className="hidden shrink-0 sm:block">
        <CarouselControls
          canScrollNext={canScrollNext}
          canScrollPrevious={canScrollPrevious}
          onNext={onNext}
          onPrevious={onPrevious}
        />
      </div>
    </div>
  );
}

function OffersFooter({
  activeIndex,
  categoryHref,
  offers,
  onSelect
}: Readonly<{
  activeIndex: number;
  categoryHref: string;
  offers: readonly Offer[];
  onSelect: (index: number) => void;
}>) {
  return (
    <>
      <MobilePagination activeIndex={activeIndex} offers={offers} onSelect={onSelect} />
      <div className="mt-8 flex justify-end">
        <a
          className="focus-ring inline-flex items-center gap-2 text-[14px] font-semibold text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          href={categoryHref}
          rel="noreferrer"
          target="_blank"
        >
          Toutes nos offres
          <ExternalLink aria-hidden="true" className="size-4" />
        </a>
      </div>
      <p aria-live="polite" className="sr-only">
        Offre {activeIndex + 1} sur {offers.length}
      </p>
    </>
  );
}

export function OffersCarousel() {
  const [activeCategory, setActiveCategory] = useState<OfferCategoryKey>("corse");
  const category = offerCategories[activeCategory];
  const { carouselState, scrollByOneItem, scrollToItem, trackRef, updateCarouselState } =
    useHorizontalCarousel(category.offers.length, activeCategory);

  return (
    <section
      aria-labelledby="offers-heading"
      className="scroll-mt-20 border-t border-border bg-[#f6f6f6] pt-14 pb-28 sm:py-16 md:py-20"
    >
      <div className="mx-auto w-full max-w-7xl px-4 lg:px-8">
        <OffersHeader
          canScrollNext={carouselState.canScrollNext}
          canScrollPrevious={carouselState.canScrollPrevious}
          onNext={() => {
            scrollByOneItem(1);
          }}
          onPrevious={() => {
            scrollByOneItem(-1);
          }}
        />

        <CategoryPicker activeCategory={activeCategory} onChange={setActiveCategory} />

        <div
          aria-label={`Offres ${category.label}`}
          aria-roledescription="carrousel"
          className="mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          id="offers-carousel"
          onScroll={updateCarouselState}
          ref={trackRef}
          role="region"
        >
          {category.offers.map((offer, index) => (
            <OfferCard
              index={index}
              key={offer.href}
              offer={offer}
              total={category.offers.length}
            />
          ))}
        </div>

        <OffersFooter
          activeIndex={carouselState.activeIndex}
          categoryHref={category.href}
          offers={category.offers}
          onSelect={scrollToItem}
        />
      </div>
    </section>
  );
}
