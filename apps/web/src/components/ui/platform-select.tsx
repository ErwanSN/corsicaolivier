import type { SelectHTMLAttributes } from 'react';

export type PlatformSelectProps = Readonly<
  SelectHTMLAttributes<HTMLSelectElement>
>;

export function PlatformSelect({ className, ...props }: PlatformSelectProps) {
  const classes = ['field-input', 'platform-select', className]
    .filter(Boolean)
    .join(' ');

  return <select className={classes} {...props} />;
}
