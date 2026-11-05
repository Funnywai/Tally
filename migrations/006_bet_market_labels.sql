alter table bet_legs drop constraint if exists bet_legs_market_check;

alter table bet_legs
  add constraint bet_legs_market_check check (
    market in (
      '1x2',
      'handicap',
      'totals',
      'other',
      'same_game',
      'anytime_scorer',
      'correct_score',
      'corner_totals',
      'corners'
    )
  );
