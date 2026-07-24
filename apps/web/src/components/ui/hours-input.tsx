import type { InputHTMLAttributes } from 'react';

type HoursInputProps = Readonly<
  Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
    description: string;
    id: string;
    label: string;
  }
>;

export function HoursInput({
  description,
  id,
  label,
  className,
  ...props
}: HoursInputProps) {
  const descriptionId = `${id}-description`;
  const classes = ['field-input', 'pr-16', className].filter(Boolean).join(' ');

  return (
    <div className="flex h-full flex-col gap-1.5">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          aria-describedby={descriptionId}
          className={classes}
          id={id}
          inputMode="decimal"
          type="number"
          {...props}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-px right-px grid w-12 place-items-center border-l border-zinc-300 bg-zinc-50 text-xs font-semibold text-zinc-600"
        >
          h
        </span>
      </div>
      <p className="text-xs leading-5 text-zinc-500" id={descriptionId}>
        {description}
      </p>
    </div>
  );
}
