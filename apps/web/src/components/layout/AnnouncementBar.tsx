import { TriangleAlert } from "lucide-react";

export function AnnouncementBar() {
  return (
    <div className="bg-[#fbf1e4] text-[#3a3226]">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-center text-[13px] leading-5">
        <TriangleAlert className="size-4 shrink-0 text-brand" />
        <p>
          <span className="font-semibold text-brand">Canicule - Transport d’animaux suspendu</span>{" "}
          <span className="hidden sm:inline">
            Du <span className="font-semibold">25 au 30 juin 2026 inclus</span>, le transport des
            équidés est <span className="font-semibold">temporairement interdit</span> en raison des
            fortes chaleurs.
          </span>
        </p>
      </div>
    </div>
  );
}
