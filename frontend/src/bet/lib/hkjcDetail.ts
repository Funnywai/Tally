import type { BetLegPayload, BetMarket } from '../types';
import { MIN_ODDS, round2 } from './profit';

const MARKET_LABELS = [
  '主客和',
  '半場主客和',
  '讓球主客和',
  '讓球',
  '半場讓球',
  '入球大細',
  '半場入球大細',
  '主隊入球大細',
  '客隊入球大細',
  '主隊半場入球大細',
  '客隊半場入球大細',
  '波膽',
  '總入球',
  '半全場',
  '入球單雙',
  '第一隊入球',
  '下一隊入球',
  '開出角球',
  '特別項目',
] as const;

const MARKET_BY_LABEL: Readonly<Record<string, BetMarket>> = {
  主客和: '1x2',
  半場主客和: '1x2',
  讓球: 'handicap',
  讓球主客和: 'handicap',
  半場讓球: 'handicap',
  入球大細: 'totals',
  半場入球大細: 'totals',
  主隊入球大細: 'totals',
  客隊入球大細: 'totals',
  主隊半場入球大細: 'totals',
  客隊半場入球大細: 'totals',
};

const LABEL_PATTERN = [...MARKET_LABELS]
  .sort((left, right) => right.length - left.length)
  .map(escapeRegExp)
  .join('|');
const MARKET_PATTERN = new RegExp(`(?:^|\\s)(${LABEL_PATTERN}|開出角球\\S*)(?=\\s|$)`, 'u');

interface MarketMatch {
  readonly label: string;
  readonly start: number;
  readonly end: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function marketForLabel(label: string): BetMarket {
  if (label.startsWith('開出角球')) {
    return 'other';
  }
  return MARKET_BY_LABEL[label] ?? 'other';
}

function matchMarketLabel(value: string): MarketMatch | null {
  const match = MARKET_PATTERN.exec(value);
  if (match === null) {
    return null;
  }
  const [whole, label] = match;
  if (whole === undefined || label === undefined) {
    return null;
  }
  const start = match.index + whole.length - label.length;
  return { label, start, end: start + label.length };
}

function splitLegTexts(detail: string): string[] | null {
  const starts: number[] = [];
  for (const match of detail.matchAll(/FB\s*\d+/gi)) {
    if (match.index !== undefined) {
      starts.push(match.index);
    }
  }
  if (starts.length === 0) {
    return null;
  }
  const texts: string[] = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    if (start === undefined) {
      return null;
    }
    const end = starts[index + 1] ?? detail.length;
    texts.push(detail.slice(start, end).trim());
  }
  return texts;
}

function parseLeg(raw: string): BetLegPayload | null {
  const codeMatch = /^FB\s*\d+\s*/i.exec(raw);
  if (codeMatch === null) {
    return null;
  }
  const body = raw.slice(codeMatch[0].length);
  const oddsMatch = /@\s*(\d+(?:\.\d+)?)/.exec(body);
  if (oddsMatch === null) {
    return null;
  }
  const odds = Number(oddsMatch[1] ?? '');
  if (!Number.isFinite(odds) || odds < MIN_ODDS) {
    return null;
  }
  const beforeOdds = body.slice(0, oddsMatch.index).trim();
  const separator = /\s+對\s+/.exec(beforeOdds);
  if (separator === null) {
    return null;
  }
  const [separatorText] = separator;
  if (separatorText === undefined) {
    return null;
  }
  const home = beforeOdds.slice(0, separator.index).trim();
  const awayAndMarket = beforeOdds.slice(separator.index + separatorText.length).trim();
  const marketMatch = matchMarketLabel(awayAndMarket);
  if (home === '' || marketMatch === null) {
    return null;
  }
  const away = awayAndMarket.slice(0, marketMatch.start).trim();
  const selection = awayAndMarket.slice(marketMatch.end).trim();
  if (away === '' || selection === '') {
    return null;
  }
  return {
    match: `${home} vs ${away}`,
    market: marketForLabel(marketMatch.label),
    selection,
    odds: round2(odds),
  };
}

export function parseLegs(detail: string): BetLegPayload[] | null {
  const texts = splitLegTexts(detail);
  if (texts === null || texts.length === 0 || texts.length > 8) {
    return null;
  }
  const legs: BetLegPayload[] = [];
  for (const text of texts) {
    const leg = parseLeg(text);
    if (leg === null) {
      return null;
    }
    legs.push(leg);
  }
  return legs;
}
