"use client";

import { X } from "lucide-react";
import { type ReactNode, type SyntheticEvent, useEffect, useId, useRef } from "react";

import { cn } from "../../lib/cn";
import { Button } from "./Button";

type ModalSize = "large" | "medium" | "small";

export type ModalProps = Readonly<{
  bodyClassName?: string;
  children: ReactNode;
  onClose: () => void;
  size?: ModalSize;
  title: string;
}>;

const modalSizeClassNames: Readonly<Record<ModalSize, string>> = {
  large: "w-[min(640px,calc(100vw-32px))]",
  medium: "w-[min(480px,calc(100vw-32px))]",
  small: "w-[min(400px,calc(100vw-32px))]"
};

export function Modal({ bodyClassName, children, onClose, size = "medium", title }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      document.body.style.overflow = previousOverflow;

      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    onClose();
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className={cn(
        "m-auto max-h-[calc(100svh-24px-env(safe-area-inset-top)-env(safe-area-inset-bottom))] min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_24px_72px_rgba(0,0,0,0.24)] [overscroll-behavior:contain] backdrop:bg-overlay max-sm:w-[calc(100vw-24px)]",
        modalSizeClassNames[size]
      )}
      onCancel={handleCancel}
      ref={dialogRef}
    >
      <div className="flex max-h-[inherit] min-h-0 flex-col">
        <header className="grid h-14 shrink-0 grid-cols-[1fr_40px] items-center border-b border-border px-4">
          <h2 className="truncate text-[16px] font-semibold leading-6" id={titleId}>
            {title}
          </h2>
          <Button
            aria-label="Fermer"
            className="size-10 justify-self-end"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        </header>

        <div className={cn("min-h-0 overflow-y-auto p-6 max-sm:p-5", bodyClassName)}>
          {children}
        </div>
      </div>
    </dialog>
  );
}
