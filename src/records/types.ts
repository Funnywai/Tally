export interface RecordPlayer {
  readonly playerId: string;
  readonly name: string;
  readonly score: number;
}

export interface RecordItem {
  readonly id: string;
  readonly date: string;
  readonly recordedAt: string;
  readonly players: RecordPlayer[];
}

export interface GameRow {
  readonly id: string;
  readonly played_at: string;
  readonly recorded_at: Date;
}

export interface SettlementRow {
  readonly game_id: string;
  readonly player_id: string;
  readonly name: string;
  readonly score: string;
}
