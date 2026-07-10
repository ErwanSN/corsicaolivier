import { useCallback, useEffect, useRef, useState } from "react";

type CarouselState = Readonly<{
  activeIndex: number;
  canScrollNext: boolean;
  canScrollPrevious: boolean;
}>;

const initialCarouselState: CarouselState = {
  activeIndex: 0,
  canScrollNext: true,
  canScrollPrevious: false
};

function getActiveIndex(track: HTMLDivElement): number {
  const trackLeft = track.getBoundingClientRect().left;
  let activeIndex = 0;
  let smallestDistance = Number.POSITIVE_INFINITY;

  Array.from(track.children).forEach((slide, index) => {
    const distance = Math.abs(slide.getBoundingClientRect().left - trackLeft);

    if (distance < smallestDistance) {
      activeIndex = index;
      smallestDistance = distance;
    }
  });

  return activeIndex;
}

export function useHorizontalCarousel(itemCount: number, resetKey: string) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [carouselState, setCarouselState] = useState<CarouselState>(initialCarouselState);

  const updateCarouselState = useCallback(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    const maxScrollLeft = track.scrollWidth - track.clientWidth;
    const nextState = {
      activeIndex: getActiveIndex(track),
      canScrollNext: track.scrollLeft < maxScrollLeft - 1,
      canScrollPrevious: track.scrollLeft > 1
    };

    setCarouselState((currentState) =>
      currentState.activeIndex === nextState.activeIndex &&
      currentState.canScrollNext === nextState.canScrollNext &&
      currentState.canScrollPrevious === nextState.canScrollPrevious
        ? currentState
        : nextState
    );
  }, []);

  useEffect(() => {
    const track = trackRef.current;

    if (!track) {
      return;
    }

    track.scrollTo({ left: 0 });
    updateCarouselState();

    const resizeObserver = new ResizeObserver(updateCarouselState);
    resizeObserver.observe(track);

    return () => {
      resizeObserver.disconnect();
    };
  }, [resetKey, updateCarouselState]);

  function scrollToItem(index: number): void {
    const track = trackRef.current;
    const item = track?.children.item(index);

    if (!(track && item instanceof HTMLElement)) {
      return;
    }

    const left = item.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollTo({ behavior: "smooth", left: track.scrollLeft + left });
  }

  function scrollByOneItem(direction: -1 | 1): void {
    const targetIndex = Math.min(itemCount - 1, Math.max(0, carouselState.activeIndex + direction));
    scrollToItem(targetIndex);
  }

  return { carouselState, scrollByOneItem, scrollToItem, trackRef, updateCarouselState };
}
