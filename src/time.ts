export const HK_TIME_ZONE = 'Asia/Hong_Kong';

const hkDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function hkDate(instant: Date): string {
  const parts = hkDateFormatter.formatToParts(instant);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Unable to format date in Asia/Hong_Kong');
  }
  return `${year}-${month}-${day}`;
}

export function hkToday(now: Date = new Date()): string {
  return hkDate(now);
}

export function hkYear(now: Date = new Date()): number {
  return Number(hkToday(now).slice(0, 4));
}

export function hkDateFromTimestamp(timestampMs: number): string {
  return hkDate(new Date(timestampMs));
}

export function isValidDateString(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [yearText, monthText, dayText] = value.split('-');
  if (yearText === undefined || monthText === undefined || dayText === undefined) {
    return false;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
