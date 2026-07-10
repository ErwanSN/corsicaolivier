import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "../../components/ds/Button";

export type CarouselControlsProps = Readonly<{
  canScrollNext: boolean;
  canScrollPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  tone?: "dark" | "light";
}>;

export function CarouselControls({
  canScrollNext,
  canScrollPrevious,
  onNext,
  onPrevious,
  tone = "light"
}: CarouselControlsProps) {
  const darkClassName =
    tone === "dark"
      ? "border-white/30 bg-transparent text-white hover:border-white/60 hover:bg-white/10"
      : undefined;

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="Afficher l'élément précédent"
        className={darkClassName}
        disabled={!canScrollPrevious}
        onClick={onPrevious}
        size="icon"
        title="Précédent"
        variant="outline"
      >
        <ChevronLeft aria-hidden="true" className="size-5" />
      </Button>
      <Button
        aria-label="Afficher l'élément suivant"
        className={darkClassName}
        disabled={!canScrollNext}
        onClick={onNext}
        size="icon"
        title="Suivant"
        variant="outline"
      >
        <ChevronRight aria-hidden="true" className="size-5" />
      </Button>
    </div>
  );
}
