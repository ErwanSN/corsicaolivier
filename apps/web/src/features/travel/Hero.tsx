import { TripSearchBar } from "./TripSearchBar";

export function Hero() {
  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden">
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
          Your Journey Begins Here
        </h1>
        <p className="mt-5 max-w-lg text-[17px] leading-6 text-white/85">
          From breathtaking coastlines to vibrant cities, discover the Mediterranean with comfort,
          reliability, and peace of mind.
        </p>
        <div className="mt-8 max-w-3xl">
          <TripSearchBar />
        </div>
      </div>
    </section>
  );
}
