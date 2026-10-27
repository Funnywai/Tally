create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  bet_date date not null,
  stake numeric(10,2) not null,
  total_odds numeric(12,2) not null,
  result text not null default 'pending',
  profit numeric(14,2),
  created_at timestamptz(3) not null default now(),
  updated_at timestamptz(3) not null default now(),
  constraint bets_stake_check check (stake > 0),
  constraint bets_total_odds_check check (total_odds > 0),
  constraint bets_result_check check (
    result in ('pending', 'win', 'half_win', 'push', 'half_loss', 'loss')
  ),
  constraint bets_profit_check check (
    (result = 'pending' and profit is null)
    or (result <> 'pending' and profit is not null)
  )
);

create table if not exists bet_legs (
  bet_id uuid not null references bets(id) on delete cascade,
  position smallint not null,
  match text not null,
  market text not null,
  selection text not null,
  odds numeric(6,2) not null,
  primary key (bet_id, position),
  constraint bet_legs_position_check check (position between 1 and 8),
  constraint bet_legs_market_check check (
    market in ('1x2', 'handicap', 'totals', 'other')
  ),
  constraint bet_legs_odds_check check (odds >= 1.01 and odds <= 1000)
);

create index if not exists bets_pagination_idx
  on bets (bet_date desc, created_at desc, id desc);
