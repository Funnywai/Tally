export type BetResult = 'pending' | 'win' | 'half_win' | 'push' | 'half_loss' | 'loss';
export type BetMarket = '1x2' | 'handicap' | 'totals' | 'other';
export type BetStatusFilter = 'all' | 'pending' | 'settled';
export type BetPeriod = 'month' | 'year' | 'all';

export interface BetLegInput {
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: number;
}

export interface BetLeg extends BetLegInput {
  readonly position: number;
}

export interface BetItem {
  readonly id: string;
  readonly date: string;
  readonly recordedAt: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: BetLeg[];
  readonly totalOdds: number;
  readonly profit: number | null;
}

export interface BetRow {
  readonly id: string;
  readonly bet_date: string;
  readonly stake: string;
  readonly total_odds: string;
  readonly result: BetResult;
  readonly profit: string | null;
  readonly created_at: Date;
}

export interface BetLegRow {
  readonly bet_id: string;
  readonly position: number;
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: string;
}

export interface BetOverviewDay {
  readonly profit: number;
  readonly settledStake: number;
  readonly settledBets: number;
  readonly pendingBets: number;
}

export interface BetOverview {
  readonly today: BetOverviewDay;
  readonly month: BetOverviewDay;
  readonly pending: { readonly count: number; readonly stake: number };
}

export interface BetTotals {
  readonly settledStake: number;
  readonly profit: number;
  readonly roi: number | null;
  readonly settledBets: number;
  readonly wins: number;
  readonly winRate: number | null;
  readonly avgOdds: number | null;
  readonly pendingCount: number;
  readonly pendingStake: number;
}

export interface BetTypeStats {
  readonly type: 'single' | 'parlay';
  readonly bets: number;
  readonly stake: number;
  readonly profit: number;
  readonly roi: number | null;
}

export interface BetMarketStats {
  readonly market: BetMarket;
  readonly bets: number;
  readonly stake: number;
  readonly profit: number;
  readonly roi: number | null;
}

export interface BetMonthlyPoint {
  readonly month: string;
  readonly profit: number;
}

export interface BetBiggest {
  readonly betId: string;
  readonly profit: number;
  readonly date: string;
  readonly label: string;
}

export interface BetStats {
  readonly period: BetPeriod;
  readonly totals: BetTotals;
  readonly byType: BetTypeStats[];
  readonly byMarket: BetMarketStats[];
  readonly monthly: BetMonthlyPoint[];
  readonly biggestWin: BetBiggest | null;
  readonly biggestLoss: BetBiggest | null;
}
