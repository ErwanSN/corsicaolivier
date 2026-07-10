import { TripSearchBar } from "./TripSearchBar";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[calc(100svh-13.5rem)] items-center overflow-hidden lg:min-h-[calc(100svh-10rem)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: "url(/hero.jpg)" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-linear-to-r from-black/45 via-black/10 to-transparent"
      />

      <div className="mx-auto w-full max-w-7xl px-4 py-16 lg:px-8">
        <h1 className="max-w-2xl text-[46px] leading-[1.05] font-medium text-white md:text-[68px]">
          Votre voyage commence ici
        </h1>
        <p className="mt-5 max-w-lg text-[17px] leading-6 text-white/85">
          Des côtes spectaculaires aux villes méditerranéennes, voyagez confortablement et en toute
          sérénité.
        </p>
        <div className="mt-8 max-w-3xl">
          <TripSearchBar />
        </div>
      </div>
    </section>
  );
}
