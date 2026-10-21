create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  played_at date not null,
  recorded_at timestamptz(3) not null default now(),
  external_id text unique,
  note text
);

create table if not exists settlements (
  game_id uuid not null references games(id) on delete cascade,
  player_id uuid not null references players(id),
  score numeric(10,1) not null,
  primary key (game_id, player_id)
);

create index if not exists games_played_at_idx on games (played_at desc);
create index if not exists settlements_player_id_idx on settlements (player_id);
