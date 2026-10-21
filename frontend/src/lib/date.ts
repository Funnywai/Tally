const HK_TIME_ZONE = 'Asia/Hong_Kong';

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: HK_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function hkToday(now: Date = new Date()): string {
  const parts = dateFormatter.formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}-${month}-${day}`;
}

export function hkYear(now: Date = new Date()): number {
  return Number(hkToday(now).slice(0, 4));
}

export function formatDateLong(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    return date;
  }
  return `${match[1] ?? ''}年${match[2] ?? ''}月${match[3] ?? ''}日`;
}

export function formatDateSlash(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) {
    return date;
  }
  return `${match[1] ?? ''}/${match[2] ?? ''}/${match[3] ?? ''}`;
}

export function formatTimeHK(instant: Date): string {
  return timeFormatter.format(instant);
}

export interface DateGroup<T> {
  readonly date: string;
  readonly records: T[];
}

export function groupByDate<T extends { date: string }>(records: readonly T[]): DateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const record of records) {
    const existing = groups.get(record.date);
    if (existing === undefined) {
      groups.set(record.date, [record]);
    } else {
      existing.push(record);
    }
  }
  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, grouped]) => ({ date, records: grouped }));
}
