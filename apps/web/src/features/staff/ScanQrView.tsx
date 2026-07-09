import { QrCode } from "lucide-react";

export function ScanQrView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-6">
      <h1 className="text-[22px] font-bold text-foreground">Scanner un QR code</h1>
      <p className="mt-1 text-[14px] text-muted">
        Placez le QR code du billet dans le cadre pour le contrôler.
      </p>

      <div className="mt-6 aspect-square w-full overflow-hidden rounded-3xl bg-surface-inverse">
        <div className="grid size-full place-items-center">
          <div className="relative grid size-56 place-items-center rounded-3xl border-2 border-dashed border-white/30">
            <QrCode className="size-16 text-white/50" />
            <span className="absolute -top-0.5 -left-0.5 size-8 rounded-tl-3xl border-t-4 border-l-4 border-brand" />
            <span className="absolute -top-0.5 -right-0.5 size-8 rounded-tr-3xl border-t-4 border-r-4 border-brand" />
            <span className="absolute -bottom-0.5 -left-0.5 size-8 rounded-bl-3xl border-b-4 border-l-4 border-brand" />
            <span className="absolute -right-0.5 -bottom-0.5 size-8 rounded-br-3xl border-r-4 border-b-4 border-brand" />
          </div>
        </div>
      </div>

      <p className="mt-4 text-center text-[13px] text-muted">
        Le scanner caméra sera bientôt disponible.
      </p>
    </div>
  );
}
