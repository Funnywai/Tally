alter table bets add column if not exists external_id text;

create unique index if not exists bets_external_id_key
  on bets (external_id)
  where external_id is not null;
