"use client";

import { ArrowRight, Cloud, CloudRain, Sun, Wind } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { CarouselControls } from "./CarouselControls";
import { type Destination, destinations } from "./home-content";
import { useHorizontalCarousel } from "./use-horizontal-carousel";

type Forecast = Readonly<{
  date: string;
  temperature: number;
  weatherCode: number;
  windDirection: number;
  windSpeed: number;
}>;

function weatherIcon(code: number) {
  if (code >= 51) return <CloudRain aria-hidden="true" className="size-7" />;
  if (code >= 2) return <Cloud aria-hidden="true" className="size-7" />;
  return <Sun aria-hidden="true" className="size-7" />;
}

function compassDirection(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
  return directions[Math.round(degrees / 45) % directions.length] ?? "N";
}

function ForecastGrid({
  forecasts,
  loading
}: Readonly<{ forecasts?: readonly Forecast[] | undefined; loading: boolean }>) {
  return (
    <div className="mt-7 grid grid-cols-3 divide-x divide-border border-y border-border py-5">
      {(forecasts ?? [undefined, undefined, undefined]).map((forecast, index) => (
        <div className="px-2 text-center sm:px-4" key={forecast?.date ?? index}>
          <p className="text-[12px] font-semibold tracking-[0.08em] text-muted uppercase">
            {forecast
              ? new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(
                  new Date(`${forecast.date}T12:00:00`)
                )
              : loading
                ? "Chargement"
                : "Indisponible"}
          </p>
          <div className="mx-auto mt-3 flex items-center justify-center gap-2 text-foreground">
            {forecast ? weatherIcon(forecast.weatherCode) : <Cloud className="size-7 opacity-30" />}
            <strong className="text-[23px] font-medium">
              {forecast ? `${String(Math.round(forecast.temperature))}°` : "—"}
            </strong>
          </div>
          <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted sm:text-[12px]">
            <Wind aria-hidden="true" className="size-3.5" />
            {forecast
              ? `${compassDirection(forecast.windDirection)} ${String(Math.round(forecast.windSpeed))} km/h`
              : loading
                ? "Données en cours"
                : "Météo indisponible"}
          </p>
        </div>
      ))}
    </div>
  );
}

function WeatherSlide({
  destination,
  forecasts,
  index,
  loading
}: Readonly<{
  destination: Destination;
  forecasts?: readonly Forecast[] | undefined;
  index: number;
  loading: boolean;
}>) {
  return (
    <article
      aria-label={`${String(index + 1)} sur ${String(destinations.length)}`}
      aria-roledescription="slide"
      className="relative min-h-[600px] shrink-0 basis-full snap-start overflow-hidden sm:min-h-[640px] md:min-h-[620px]"
      role="group"
    >
      <Image
        alt=""
        className="object-cover"
        fill
        priority={index === 0}
        sizes="100vw"
        src={destination.image}
      />
      <div className="absolute inset-0 bg-linear-to-r from-black/50 via-black/10 to-black/55" />

      <div className="relative mx-auto flex min-h-[600px] w-full max-w-7xl items-end px-4 py-5 sm:min-h-[640px] sm:px-6 sm:py-8 md:min-h-[620px] md:items-center md:justify-end md:py-12 lg:px-8">
        <div className="w-full rounded-2xl border border-white/60 bg-surface/94 p-5 text-foreground shadow-2xl backdrop-blur-md sm:p-6 md:max-w-[570px] md:p-9">
          <p className="text-[12px] font-bold tracking-[0.16em] text-brand uppercase">
            Escale & météo
          </p>
          <h3 className="mt-2 text-[30px] leading-tight font-semibold sm:mt-3 sm:text-[34px] md:text-[42px]">
            {destination.title}
          </h3>
          <p className="mt-3 line-clamp-2 text-[14px] leading-6 text-foreground/65 sm:mt-4 sm:line-clamp-3 sm:text-[15px] md:text-[16px]">
            {destination.description}
          </p>

          <ForecastGrid forecasts={forecasts} loading={loading} />

          <a
            className="focus-ring mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-center text-[14px] font-semibold text-white transition hover:bg-brand/90 sm:mt-7 sm:inline-flex sm:w-auto"
            href={destination.href}
            rel="noreferrer"
            target="_blank"
          >
            Découvrir la destination
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
        </div>
      </div>
    </article>
  );
}

async function loadForecasts(): Promise<readonly (readonly Forecast[] | undefined)[]> {
  const response = await fetch("/api/weather");
  if (!response.ok) throw new Error("Weather service unavailable");
  return (await response.json()) as readonly (readonly Forecast[])[];
}

export function DestinationsCarousel() {
  const [forecasts, setForecasts] = useState<readonly (readonly Forecast[] | undefined)[]>();
  const [loading, setLoading] = useState(true);
  const { carouselState, scrollByOneItem, trackRef, updateCarouselState } = useHorizontalCarousel(
    destinations.length,
    "destinations-weather"
  );

  useEffect(() => {
    let active = true;
    void loadForecasts()
      .then((nextForecasts) => {
        if (active) setForecasts(nextForecasts);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section
      aria-labelledby="weather-heading"
      className="scroll-mt-20 bg-surface py-12 sm:py-16 md:py-20"
    >
      <div className="mx-auto mb-7 flex w-full max-w-7xl items-end justify-between gap-4 px-4 sm:mb-8 sm:px-6 lg:px-8">
        <div>
          <p className="text-[13px] font-bold tracking-[0.12em] text-brand uppercase">
            Préparez votre arrivée
          </p>
          <h2
            className="mt-2 text-[30px] leading-9 font-semibold text-foreground md:text-[38px] md:leading-[44px]"
            id="weather-heading"
          >
            La météo de nos destinations
          </h2>
        </div>
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

      <div
        aria-label="Météo des destinations desservies"
        aria-roledescription="carrousel"
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={updateCarouselState}
        ref={trackRef}
        role="region"
      >
        {destinations.map((destination, index) => (
          <WeatherSlide
            destination={destination}
            forecasts={forecasts?.[index]}
            index={index}
            key={destination.href}
            loading={loading}
          />
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        Destination {carouselState.activeIndex + 1} sur {destinations.length}
      </p>
    </section>
  );
}
