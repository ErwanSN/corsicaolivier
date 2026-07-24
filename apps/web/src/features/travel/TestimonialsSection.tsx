import { Quote } from "lucide-react";
import Image from "next/image";

import { testimonials, type Testimonial } from "./home-content";

export function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      className="relative isolate scroll-mt-20 overflow-hidden py-14 text-white sm:py-20 md:py-28"
    >
      <Image
        alt=""
        className="-z-20 object-cover"
        fill
        sizes="100vw"
        src="/home/destinations/corse.webp"
      />
      <div className="absolute inset-0 -z-10 bg-[#171717]/70" />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/75">
            Expériences à bord
          </p>
          <h2
            className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl"
            id="testimonials-heading"
          >
            Ils ont voyagé avec nous
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard
              key={`${testimonial.author}-${testimonial.date}`}
              testimonial={testimonial}
            />
          ))}
        </div>

        <p className="mt-6 text-xs text-white/75">
          Avis collectés après une traversée par un organisme indépendant.
        </p>
      </div>
    </section>
  );
}

function TestimonialCard({ testimonial }: Readonly<{ testimonial: Testimonial }>) {
  return (
    <figure className="flex min-h-0 flex-col rounded-2xl bg-white/95 p-5 text-foreground shadow-lg backdrop-blur-sm sm:min-h-64 sm:p-6">
      <Quote aria-hidden="true" className="size-7 fill-brand/10 text-brand" />
      <blockquote className="mt-5 flex-1 text-base font-medium leading-7">
        « {testimonial.quote} »
      </blockquote>
      <figcaption className="mt-7 border-t border-border pt-4">
        <p className="font-bold">{testimonial.author}</p>
        <p className="mt-1 text-xs text-muted">Traversée du {testimonial.date}</p>
      </figcaption>
    </figure>
  );
}
