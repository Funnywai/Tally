create index if not exists games_pagination_idx
  on games (played_at desc, recorded_at desc, id desc);
