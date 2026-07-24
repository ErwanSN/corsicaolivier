export function currentParisDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function mondayOf(date: string): string {
  const instant = new Date(`${date}T12:00:00Z`);
  const day = instant.getUTCDay() || 7;
  instant.setUTCDate(instant.getUTCDate() - day + 1);

  return instant.toISOString().slice(0, 10);
}
