alter table bets drop constraint if exists bets_result_check;

alter table bets
  add constraint bets_result_check check (
    result in ('pending', 'win', 'half_win', 'push', 'half_loss', 'loss', 'cash_out')
  );
