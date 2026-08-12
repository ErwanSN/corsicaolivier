export function hours(minutes: number | null): string {
  if (minutes === null) return '—';
  return `${(minutes / 60).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} h`;
}

export function activeOn(
  validFrom: string,
  validUntil: string | null,
  date: string,
): boolean {
  return validFrom <= date && (!validUntil || validUntil >= date);
}

export function dateTimeFormatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  });
}
