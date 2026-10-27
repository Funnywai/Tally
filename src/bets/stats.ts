import type { Pool } from 'pg';
import { round2 } from './profit.js';
import type {
  BetBiggest,
  BetMarket,
  BetMarketStats,
  BetMonthlyPoint,
  BetOverview,
  BetOverviewDay,
  BetPeriod,
  BetStats,
  BetTotals,
  BetTypeStats,
} from './types.js';

function emptyOverviewDay(): BetOverviewDay {
  return { profit: 0, settledStake: 0, settledBets: 0, pendingBets: 0 };
}

function emptyOverview(): BetOverview {
  return { today: emptyOverviewDay(), month: emptyOverviewDay(), pending: { count: 0, stake: 0 } };
}

function toNumber(value: string | null): number {
  return value === null ? 0 : Number(value);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round2((numerator / denominator) * 100);
}

function periodClause(period: BetPeriod): string {
  switch (period) {
    case 'month':
      return `b.bet_date >= date_trunc('month', current_date)::date
              and b.bet_date < (date_trunc('month', current_date) + interval '1 month')::date`;
    case 'year':
      return `b.bet_date >= date_trunc('year', current_date)::date
              and b.bet_date < (date_trunc('year', current_date) + interval '1 year')::date`;
    case 'all':
      return 'true';
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

interface OverviewRow {
  readonly today_profit: string;
  readonly today_stake: string;
  readonly today_settled: number;
  readonly today_pending: number;
  readonly month_profit: string;
  readonly month_stake: string;
  readonly month_settled: number;
  readonly month_pending: number;
  readonly pending_count: number;
  readonly pending_stake: string;
}

export async function getOverview(pool: Pool): Promise<BetOverview> {
  const result = await pool.query<OverviewRow>(
    `select
       coalesce(sum(profit) filter (
         where bet_date = current_date and result <> 'pending'
       ), 0)::text as today_profit,
       coalesce(sum(stake) filter (
         where bet_date = current_date and result <> 'pending'
       ), 0)::text as today_stake,
       count(*) filter (
         where bet_date = current_date and result <> 'pending'
       )::int as today_settled,
       count(*) filter (
         where bet_date = current_date and result = 'pending'
       )::int as today_pending,
       coalesce(sum(profit) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result <> 'pending'
       ), 0)::text as month_profit,
       coalesce(sum(stake) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result <> 'pending'
       ), 0)::text as month_stake,
       count(*) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result <> 'pending'
       )::int as month_settled,
       count(*) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result = 'pending'
       )::int as month_pending,
       count(*) filter (where result = 'pending')::int as pending_count,
       coalesce(sum(stake) filter (where result = 'pending'), 0)::text as pending_stake
     from bets`,
  );

  const row = result.rows[0];
  if (row === undefined) {
    return emptyOverview();
  }

  return {
    today: {
      profit: round2(toNumber(row.today_profit)),
      settledStake: round2(toNumber(row.today_stake)),
      settledBets: row.today_settled,
      pendingBets: row.today_pending,
    },
    month: {
      profit: round2(toNumber(row.month_profit)),
      settledStake: round2(toNumber(row.month_stake)),
      settledBets: row.month_settled,
      pendingBets: row.month_pending,
    },
    pending: {
      count: row.pending_count,
      stake: round2(toNumber(row.pending_stake)),
    },
  };
}

interface TotalsRow {
  readonly settled_stake: string;
  readonly profit: string;
  readonly settled_bets: number;
  readonly wins: number;
  readonly avg_odds: string | null;
  readonly pending_count: number;
  readonly pending_stake: string;
}

interface TypeRow {
  readonly type: 'single' | 'parlay';
  readonly bets: number;
  readonly stake: string;
  readonly profit: string;
}

interface MarketRow {
  readonly market: BetMarket;
  readonly bets: number;
  readonly stake: string;
  readonly profit: string;
}

interface MonthlyRow {
  readonly month: string;
  readonly profit: string;
}

interface BiggestRow {
  readonly id: string;
  readonly date: string;
  readonly profit: string;
  readonly label: string;
}

async function getBiggest(
  pool: Pool,
  where: string,
  kind: 'win' | 'loss',
): Promise<BetBiggest | null> {
  const operator = kind === 'win' ? '>' : '<';
  const order = kind === 'win' ? 'desc' : 'asc';
  const result = await pool.query<BiggestRow>(
    `with candidates as (
       select b.id,
              to_char(b.bet_date, 'YYYY-MM-DD') as date,
              b.profit,
              (select count(*) from bet_legs l where l.bet_id = b.id)::int as leg_count,
              (select l.match
                 from bet_legs l
                where l.bet_id = b.id
                order by l.position asc
                limit 1) as first_match
         from bets b
        where ${where}
          and b.result <> 'pending'
     )
     select id,
            date,
            profit::text,
            case
              when leg_count = 1 then first_match
              else leg_count::text || '串1'
            end as label
       from candidates
      where candidates.profit ${operator} 0
      order by candidates.profit ${order}, candidates.date asc, candidates.id asc
      limit 1`,
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    betId: row.id,
    profit: round2(Number(row.profit)),
    date: row.date,
    label: row.label,
  };
}

export async function getBetStats(pool: Pool, period: BetPeriod): Promise<BetStats> {
  const where = periodClause(period);

  const [totalsResult, typeResult, marketResult, monthlyResult, biggestWin, biggestLoss] =
    await Promise.all([
      pool.query<TotalsRow>(
        `select
           coalesce(sum(b.stake) filter (where b.result <> 'pending'), 0)::text as settled_stake,
           coalesce(sum(b.profit) filter (where b.result <> 'pending'), 0)::text as profit,
           count(*) filter (where b.result <> 'pending')::int as settled_bets,
           count(*) filter (where b.result <> 'pending' and b.profit > 0)::int as wins,
           avg(b.total_odds) filter (where b.result <> 'pending')::text as avg_odds,
           count(*) filter (where b.result = 'pending')::int as pending_count,
           coalesce(sum(b.stake) filter (where b.result = 'pending'), 0)::text as pending_stake
         from bets b
         where ${where}`,
      ),
      pool.query<TypeRow>(
        `with per_bet as (
           select b.id,
                  b.stake,
                  b.profit,
                  b.result,
                  (select count(*) from bet_legs l where l.bet_id = b.id)::int as leg_count
             from bets b
            where ${where}
         )
         select case when leg_count = 1 then 'single' else 'parlay' end as type,
                count(*) filter (where result <> 'pending')::int as bets,
                coalesce(sum(stake) filter (where result <> 'pending'), 0)::text as stake,
                coalesce(sum(profit) filter (where result <> 'pending'), 0)::text as profit
           from per_bet
          group by 1`,
      ),
      pool.query<MarketRow>(
        `with single_bets as (
           select bet_id from bet_legs group by bet_id having count(*) = 1
         )
         select l.market,
                count(*)::int as bets,
                coalesce(sum(b.stake), 0)::text as stake,
                coalesce(sum(b.profit), 0)::text as profit
           from bets b
           join single_bets s on s.bet_id = b.id
           join bet_legs l on l.bet_id = b.id
          where ${where}
            and b.result <> 'pending'
          group by l.market
          order by sum(b.stake) desc, l.market asc`,
      ),
      pool.query<MonthlyRow>(
        `with months as (
           select generate_series(
             date_trunc('month', current_date) - interval '5 months',
             date_trunc('month', current_date),
             interval '1 month'
           )::date as month_start
         ),
         totals as (
           select date_trunc('month', bet_date)::date as month_start,
                  coalesce(sum(profit), 0)::text as profit
             from bets
            where result <> 'pending'
            group by 1
         )
         select to_char(m.month_start, 'YYYY-MM') as month,
                coalesce(t.profit, '0') as profit
           from months m
           left join totals t on t.month_start = m.month_start
          order by m.month_start`,
      ),
      getBiggest(pool, where, 'win'),
      getBiggest(pool, where, 'loss'),
    ]);

  const totalsRow = totalsResult.rows[0];
  const settledStake = round2(toNumber(totalsRow?.settled_stake ?? '0'));
  const profit = round2(toNumber(totalsRow?.profit ?? '0'));
  const settledBets = totalsRow?.settled_bets ?? 0;
  const wins = totalsRow?.wins ?? 0;
  const totals: BetTotals = {
    settledStake,
    profit,
    roi: ratio(profit, settledStake),
    settledBets,
    wins,
    winRate: ratio(wins, settledBets),
    avgOdds:
      totalsRow?.avg_odds === null || totalsRow?.avg_odds === undefined
        ? null
        : round2(Number(totalsRow.avg_odds)),
    pendingCount: totalsRow?.pending_count ?? 0,
    pendingStake: round2(toNumber(totalsRow?.pending_stake ?? '0')),
  };

  const byType: BetTypeStats[] = (['single', 'parlay'] as const).map((type) => {
    const row = typeResult.rows.find((item) => item.type === type);
    const stake = round2(toNumber(row?.stake ?? '0'));
    const typeProfit = round2(toNumber(row?.profit ?? '0'));
    return {
      type,
      bets: row?.bets ?? 0,
      stake,
      profit: typeProfit,
      roi: ratio(typeProfit, stake),
    };
  });

  const byMarket: BetMarketStats[] = marketResult.rows.map((row) => {
    const stake = round2(toNumber(row.stake));
    const marketProfit = round2(toNumber(row.profit));
    return {
      market: row.market,
      bets: row.bets,
      stake,
      profit: marketProfit,
      roi: ratio(marketProfit, stake),
    };
  });

  const monthly: BetMonthlyPoint[] = monthlyResult.rows.map((row) => ({
    month: row.month,
    profit: round2(Number(row.profit)),
  }));

  return { period, totals, byType, byMarket, monthly, biggestWin, biggestLoss };
}
