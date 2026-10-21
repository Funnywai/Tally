const HK_TIME_ZONE = 'Asia/Hong_Kong';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const hkDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: HK_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const [yearText, monthText, dayText] = value.split('-');
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

export function hkDateFromTimestamp(timestampMs) {
  const parts = hkDateFormatter.formatToParts(new Date(timestampMs));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error('Unable to format date in Asia/Hong_Kong');
  }
  return `${year}-${month}-${day}`;
}

export function numericTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toFiniteScore(raw) {
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

export function extractRecords(parsed) {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Root JSON must be an object');
  }
  const candidate = parsed.records;
  if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
    return candidate;
  }
  return parsed;
}

export function mapRecord(key, record, nowMs = Date.now()) {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) {
    return { ok: false, reason: '記錄格式無效' };
  }

  const rawPlayers = record.players;
  if (
    typeof rawPlayers !== 'object' ||
    rawPlayers === null ||
    Array.isArray(rawPlayers) ||
    Object.keys(rawPlayers).length === 0
  ) {
    return { ok: false, reason: 'players 為空' };
  }

  const players = [];
  for (const [name, rawScore] of Object.entries(rawPlayers)) {
    const score = toFiniteScore(rawScore);
    if (score === null) {
      return { ok: false, reason: `分數不是有限數字：${name}` };
    }
    players.push({ name, score: round1(score) });
  }

  const timestamp = numericTimestamp(record.timestamp) ?? numericTimestamp(key);
  const playedAt =
    typeof record.date === 'string' && isValidDateString(record.date)
      ? record.date
      : hkDateFromTimestamp(timestamp ?? nowMs);
  const recordedAt = new Date(timestamp ?? nowMs).toISOString();

  return {
    ok: true,
    value: {
      externalId: String(key),
      playedAt,
      recordedAt,
      players,
    },
  };
}

export function computeExpectedTotals(records, nowMs = Date.now()) {
  const totals = new Map();
  for (const [key, record] of Object.entries(records)) {
    const mapped = mapRecord(key, record, nowMs);
    if (!mapped.ok) {
      continue;
    }
    for (const player of mapped.value.players) {
      totals.set(player.name, round1((totals.get(player.name) ?? 0) + player.score));
    }
  }
  return totals;
}

export function collectUnderscoreNames(records, nowMs = Date.now()) {
  const names = new Set();
  for (const [key, record] of Object.entries(records)) {
    const mapped = mapRecord(key, record, nowMs);
    if (!mapped.ok) {
      continue;
    }
    for (const player of mapped.value.players) {
      if (player.name.includes('_')) {
        names.add(player.name);
      }
    }
  }
  return [...names].sort();
}
