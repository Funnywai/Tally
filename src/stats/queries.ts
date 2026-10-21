import type { Pool } from 'pg';
import { round1 } from '../time.js';

export interface ScoreDate {
  readonly score: number;
  readonly date: string;
}

export interface PlayerStats {
  readonly player: string;
  readonly year: number;
  readonly yearTotal: number;
  readonly yearGames: number;
  readonly yearWins: number;
  readonly winRate: number | null;
  readonly best: ScoreDate | null;
  readonly worst: ScoreDate | null;
  readonly avgWin: number | null;
  readonly avgLoss: number | null;
  readonly allTimeGames: number;
}

export interface RankingEntry {
  readonly playerId: string;
  readonly name: string;
  readonly total: number;
  readonly wins: number;
  readonly losses: number;
  readonly games: number;
}

interface StatsRow {
  readonly total: string;
  readonly year_games: number;
  readonly year_wins: number;
  readonly all_time_games: number;
  readonly avg_win: string | null;
  readonly avg_loss: string | null;
  readonly best_score: string | null;
  readonly best_date: string | null;
  readonly worst_score: string | null;
  readonly worst_date: string | null;
}

interface RankingRow {
  readonly id: string;
  readonly name: string;
  readonly total: string;
  readonly wins: number;
  readonly losses: number;
  readonly games: number;
}

function emptyStats(player: string, year: number): PlayerStats {
  return {
    player,
    year,
    yearTotal: 0,
    yearGames: 0,
    yearWins: 0,
    winRate: null,
    best: null,
    worst: null,
    avgWin: null,
    avgLoss: null,
    allTimeGames: 0,
  };
}

function toScoreDate(score: string | null, date: string | null): ScoreDate | null {
  if (score === null || date === null) {
    return null;
  }
  return { score: Number(score), date };
}

export async function getPlayerStats(
  pool: Pool,
  playerName: string,
  year: number,
): Promise<PlayerStats> {
  const player = await pool.query<{ id: string }>('select id from players where name = $1', [
    playerName,
  ]);
  const playerId = player.rows[0]?.id;
  if (playerId === undefined) {
    return emptyStats(playerName, year);
  }

  const result = await pool.query<StatsRow>(
    `with year_stats as (
       select coalesce(sum(s.score), 0)::text as total,
              count(*)::int as games,
              count(*) filter (where s.score > 0)::int as wins
         from settlements s
         join games g on g.id = s.game_id
        where s.player_id = $1
          and extract(year from g.played_at) = $2
     ),
     all_stats as (
       select count(*)::int as games,
              avg(s.score) filter (where s.score > 0)::text as avg_win,
              avg(s.score) filter (where s.score < 0)::text as avg_loss
         from settlements s
        where s.player_id = $1
     ),
     best as (
       select s.score::text as score, to_char(g.played_at, 'YYYY-MM-DD') as date
         from settlements s
         join games g on g.id = s.game_id
        where s.player_id = $1
        order by s.score desc, g.played_at asc, g.recorded_at asc
        limit 1
     ),
     worst as (
       select s.score::text as score, to_char(g.played_at, 'YYYY-MM-DD') as date
         from settlements s
         join games g on g.id = s.game_id
        where s.player_id = $1
        order by s.score asc, g.played_at asc, g.recorded_at asc
        limit 1
     )
     select y.total, y.games as year_games, y.wins as year_wins,
            a.games as all_time_games, a.avg_win, a.avg_loss,
            b.score as best_score, b.date as best_date,
            w.score as worst_score, w.date as worst_date
       from year_stats y
       cross join all_stats a
       left join best b on true
       left join worst w on true`,
    [playerId, year],
  );

  const row = result.rows[0];
  if (row === undefined) {
    return emptyStats(playerName, year);
  }

  const yearGames = row.year_games;
  const yearWins = row.year_wins;
  return {
    player: playerName,
    year,
    yearTotal: round1(Number(row.total)),
    yearGames,
    yearWins,
    winRate: yearGames > 0 ? round1((yearWins / yearGames) * 100) : null,
    best: toScoreDate(row.best_score, row.best_date),
    worst: toScoreDate(row.worst_score, row.worst_date),
    avgWin: row.avg_win === null ? null : round1(Number(row.avg_win)),
    avgLoss: row.avg_loss === null ? null : round1(Number(row.avg_loss)),
    allTimeGames: row.all_time_games,
  };
}

export async function getRanking(pool: Pool): Promise<RankingEntry[]> {
  const result = await pool.query<RankingRow>(
    `select p.id, p.name, sum(s.score)::text as total,
            count(*) filter (where s.score > 0)::int as wins,
            count(*) filter (where s.score < 0)::int as losses,
            count(*)::int as games
       from settlements s
       join players p on p.id = s.player_id
      group by p.id, p.name
      order by sum(s.score) desc, p.name asc`,
  );

  return result.rows.map((row) => ({
    playerId: row.id,
    name: row.name,
    total: round1(Number(row.total)),
    wins: row.wins,
    losses: row.losses,
    games: row.games,
  }));
}
