export function currentDateInTimeZone(
  timeZone: string,
  instant: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

export function currentInstant(): number {
  return Date.now();
}

/**
 * Converts an HTML datetime-local value in an IANA timezone to an instant.
 * Non-existent and ambiguous wall-clock times at DST boundaries are rejected
 * instead of silently choosing the wrong service hour.
 */
export function zonedLocalToIso(
  value: string,
  timeZone: string,
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );

  if (!match) return null;

  const [, year, month, day, hour, minute, second = '0'] = match;
  const expected = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };
  const localAsUtc = Date.UTC(
    expected.year,
    expected.month - 1,
    expected.day,
    expected.hour,
    expected.minute,
    expected.second,
  );
  const normalized = new Date(localAsUtc);

  if (
    normalized.getUTCFullYear() !== expected.year ||
    normalized.getUTCMonth() + 1 !== expected.month ||
    normalized.getUTCDate() !== expected.day ||
    normalized.getUTCHours() !== expected.hour ||
    normalized.getUTCMinutes() !== expected.minute ||
    normalized.getUTCSeconds() !== expected.second
  ) {
    return null;
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    const partsAt = (instant: number) =>
      Object.fromEntries(
        formatter
          .formatToParts(new Date(instant))
          .filter((part) => part.type !== 'literal')
          .map((part) => [part.type, Number(part.value)]),
      );
    const offsetAt = (instant: number) => {
      const parts = partsAt(instant);
      return (
        Date.UTC(
          parts.year,
          parts.month - 1,
          parts.day,
          parts.hour,
          parts.minute,
          parts.second,
        ) - instant
      );
    };
    const candidateOffsets = new Set([
      offsetAt(localAsUtc - 36 * 60 * 60 * 1_000),
      offsetAt(localAsUtc),
      offsetAt(localAsUtc + 36 * 60 * 60 * 1_000),
    ]);
    const matchingInstants = [...candidateOffsets]
      .map((offset) => localAsUtc - offset)
      .filter((instant) => {
        const resolved = partsAt(instant);
        return (
          resolved.year === expected.year &&
          resolved.month === expected.month &&
          resolved.day === expected.day &&
          resolved.hour === expected.hour &&
          resolved.minute === expected.minute &&
          resolved.second === expected.second
        );
      });

    return matchingInstants.length === 1
      ? new Date(matchingInstants[0]).toISOString()
      : null;
  } catch {
    return null;
  }
}

export function mondayOf(date: string): string {
  const instant = new Date(`${date}T12:00:00Z`);
  const day = instant.getUTCDay() || 7;
  instant.setUTCDate(instant.getUTCDate() - day + 1);

  return instant.toISOString().slice(0, 10);
}
