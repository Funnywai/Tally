import type { BetDraft, BetItem, BetLegPayload, BetPayload } from '../types';
import {
  computeTotalOdds,
  MAX_ODDS,
  MAX_STAKE,
  MAX_TOTAL_ODDS,
  MIN_ODDS,
  MIN_STAKE,
  round2,
} from './profit';

export interface BetDraftLegErrors {
  readonly match?: string;
  readonly selection?: string;
  readonly odds?: string;
}

export interface BetDraftErrors {
  readonly date?: string;
  readonly stake?: string;
  readonly legs: BetDraftLegErrors[];
  readonly legsCount?: string;
  readonly totalOdds?: string;
}

export interface ParsedDraft {
  readonly payload: BetPayload | null;
  readonly errors: BetDraftErrors;
  readonly totalOdds: number | null;
}

export function emptyDraft(date: string): BetDraft {
  return {
    date,
    stake: '',
    result: 'pending',
    legs: [{ match: '', market: '1x2', selection: '', odds: '' }],
  };
}

export function draftFromBet(bet: BetItem): BetDraft {
  return {
    date: bet.date,
    stake: String(bet.stake),
    result: bet.result,
    legs: bet.legs.map((leg) => ({
      match: leg.match,
      market: leg.market,
      selection: leg.selection,
      odds: String(leg.odds),
    })),
  };
}

function codePointLength(value: string): number {
  return [...value].length;
}

export function parseDraft(draft: BetDraft): ParsedDraft {
  const legErrors: BetDraftLegErrors[] = draft.legs.map(() => ({}));
  const dateError = draft.date.trim() === '' ? '請選擇日期' : undefined;
  const legsCountError =
    draft.legs.length < 1 || draft.legs.length > 8 ? '注單必須有 1–8 場' : undefined;

  const stake = Number(draft.stake);
  const stakeError =
    !Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE
      ? `注碼必須介乎 ${MIN_STAKE} 與 ${MAX_STAKE}`
      : undefined;

  const legs: BetLegPayload[] = [];
  draft.legs.forEach((leg, index) => {
    const current: { match?: string; selection?: string; odds?: string } = {};
    const match = leg.match.trim();
    if (codePointLength(match) < 1 || codePointLength(match) > 80) {
      current.match = '賽事必須為 1–80 個字元';
    }
    const selection = leg.selection.trim();
    if (codePointLength(selection) < 1 || codePointLength(selection) > 60) {
      current.selection = '選擇必須為 1–60 個字元';
    }
    const odds = Number(leg.odds);
    if (!Number.isFinite(odds) || odds < MIN_ODDS || odds > MAX_ODDS) {
      current.odds = `賠率必須介乎 ${MIN_ODDS} 與 ${MAX_ODDS}`;
    }
    legErrors[index] = current;
    if (Object.keys(current).length === 0) {
      legs.push({
        match,
        market: leg.market,
        selection,
        odds: round2(odds),
      });
    }
  });

  const hasLegErrors = legErrors.some((leg) => Object.keys(leg).length > 0);
  const totalOdds = hasLegErrors || legsCountError !== undefined ? null : computeTotalOdds(legs);
  const totalOddsError =
    totalOdds !== null && totalOdds > MAX_TOTAL_ODDS
      ? `總賠率不可超過 ${MAX_TOTAL_ODDS}`
      : undefined;

  const valid =
    dateError === undefined &&
    stakeError === undefined &&
    !hasLegErrors &&
    legsCountError === undefined &&
    totalOddsError === undefined;

  return {
    payload: valid
      ? {
          date: draft.date,
          stake: round2(stake),
          result: draft.result,
          legs,
        }
      : null,
    errors: {
      legs: legErrors,
      ...(dateError !== undefined ? { date: dateError } : {}),
      ...(stakeError !== undefined ? { stake: stakeError } : {}),
      ...(legsCountError !== undefined ? { legsCount: legsCountError } : {}),
      ...(totalOddsError !== undefined ? { totalOdds: totalOddsError } : {}),
    },
    totalOdds,
  };
}
