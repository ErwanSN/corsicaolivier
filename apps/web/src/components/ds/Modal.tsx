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

    const previousOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${String(scrollbarWidth)}px`;

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousPaddingRight;

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
        "fixed inset-0 m-auto max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] max-w-none min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-0 text-foreground shadow-[0_24px_72px_rgba(0,0,0,0.24)] [overscroll-behavior:contain] backdrop:bg-overlay max-sm:w-[calc(100vw_-_1.5rem)]",
        modalSizeClassNames[size]
      )}
      onCancel={handleCancel}
      ref={dialogRef}
    >
      <div className="flex max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] min-h-0 flex-col">
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

        <div
          className={cn(
            "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-6 max-sm:p-5",
            bodyClassName
          )}
        >
          {children}
        </div>
      </div>
    </dialog>
  );
}
