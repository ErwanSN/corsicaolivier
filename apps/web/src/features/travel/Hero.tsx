import { TripSearchBar } from "./TripSearchBar";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-4rem)] items-center overflow-hidden sm:min-h-[500px] lg:h-[68svh] lg:min-h-[540px] lg:max-h-[620px]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-[62%_center] sm:bg-center"
        style={{ backgroundImage: "url(/hero.jpg)" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-black/30 sm:bg-linear-to-r sm:from-black/50 sm:via-black/15 sm:to-transparent"
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8 lg:py-14">
        <h1 className="max-w-2xl text-[clamp(2.25rem,11vw,3rem)] leading-[1.04] font-medium text-balance text-white md:text-[68px]">
          Votre voyage commence ici
        </h1>
        <p className="mt-4 max-w-lg text-[15px] leading-6 text-white/90 sm:text-[17px]">
          Des côtes spectaculaires aux villes méditerranéennes, voyagez confortablement et en toute
          sérénité.
        </p>
        <div className="mt-6 max-w-3xl">
          <TripSearchBar />
        </div>
      </div>
    </section>
  );
}
