export type BetResult = 'pending' | 'win' | 'half_win' | 'push' | 'half_loss' | 'loss' | 'cash_out';
export type BetMarket =
  | '1x2'
  | 'handicap'
  | 'totals'
  | 'other'
  | 'same_game'
  | 'anytime_scorer'
  | 'correct_score'
  | 'corner_totals'
  | 'corners';
export type BetStatusFilter = 'all' | 'pending' | 'settled';
export type BetPeriod = 'last30' | 'year' | 'all';

export interface BetLeg {
  readonly position: number;
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: number;
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

export interface BetListResponse {
  readonly items: BetItem[];
  readonly nextCursor: string | null;
}

export interface BetOverviewDay {
  readonly profit: number;
  readonly settledStake: number;
  readonly settledBets: number;
  readonly pendingBets: number;
}

export interface BetOverview {
  readonly today: BetOverviewDay;
  readonly last30Days: BetOverviewDay;
  readonly last90Days: BetOverviewDay;
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

export interface BetLegPayload {
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: number;
}

export interface BetPayload {
  readonly date: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: BetLegPayload[];
  readonly profitOverride?: number;
}

export interface HkjcImportRow {
  readonly externalId: string;
  readonly date: string;
  readonly time: string;
  readonly stake: number;
  readonly payout: number;
  readonly result: BetResult;
  readonly profitOverride: number | null;
  readonly legs: BetLegPayload[];
  readonly betType: string;
  readonly detail: string;
  readonly warnings: string[];
}

export interface HkjcParseResult {
  readonly rows: HkjcImportRow[];
  readonly warnings: string[];
}

export type BetImportStatus = 'new' | 'duplicate' | 'imported';

export interface BetImportItemResult {
  readonly externalId: string;
  readonly status: BetImportStatus;
}

export interface BetImportResponse {
  readonly dryRun: boolean;
  readonly imported: number;
  readonly skipped: number;
  readonly items: BetImportItemResult[];
}

export interface BetImportBet {
  readonly externalId: string;
  readonly date: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: BetLegPayload[];
  readonly profitOverride?: number | null;
}

export interface BetImportPayload {
  readonly dryRun: boolean;
  readonly bets: BetImportBet[];
}

export interface BetDraftLeg {
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: string;
}

export interface BetDraft {
  readonly date: string;
  readonly stake: string;
  readonly result: BetResult;
  readonly legs: BetDraftLeg[];
  readonly payout: string;
}
