export type Quad<T> = [T, T, T, T];
export type Triple<T> = [T, T, T];
export type PlayerIndex = 0 | 1 | 2 | 3;
export type ColumnIndex = 0 | 1 | 2;
export type Column = (number | null)[];

export const PLAYER_INDICES: readonly PlayerIndex[] = [0, 1, 2, 3];
export const COLUMN_INDICES: readonly ColumnIndex[] = [0, 1, 2];
export const ROW_COUNT = 7;
export const MAX_NAME_LENGTH = 7;
