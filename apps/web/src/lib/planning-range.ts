export type WeeklyPlanningRange = Readonly<{
  startsOn: string;
  endsOn: string;
}>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isDate(value: string | undefined): value is string {
  if (!value || !DATE_PATTERN.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime());
}

export function addDays(date: string, amount: number): string {
  const instant = new Date(`${date}T12:00:00.000Z`);
  instant.setUTCDate(instant.getUTCDate() + amount);
  return instant.toISOString().slice(0, 10);
}

function mondayOfDate(date: string): string {
  const instant = new Date(`${date}T12:00:00.000Z`);
  const weekday = instant.getUTCDay() || 7;
  instant.setUTCDate(instant.getUTCDate() - weekday + 1);
  return instant.toISOString().slice(0, 10);
}

export function resolveWeeklyRange(
  date: string | undefined,
  today: string,
): WeeklyPlanningRange {
  const anchorDate = isDate(date) ? date : today;
  const startsOn = mondayOfDate(anchorDate);

  return {
    startsOn,
    endsOn: addDays(startsOn, 6),
  };
}
