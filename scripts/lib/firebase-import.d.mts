export interface ImportedPlayer {
  readonly name: string;
  readonly score: number;
}

export interface ImportedRecord {
  readonly externalId: string;
  readonly playedAt: string;
  readonly recordedAt: string;
  readonly players: ImportedPlayer[];
}

export type MapRecordResult =
  | { readonly ok: true; readonly value: ImportedRecord }
  | { readonly ok: false; readonly reason: string };

export function isValidDateString(value: unknown): boolean;
export function hkDateFromTimestamp(timestampMs: number): string;
export function numericTimestamp(value: unknown): number | null;
export function extractRecords(parsed: unknown): Record<string, unknown>;
export function mapRecord(key: string, record: unknown, nowMs?: number): MapRecordResult;
export function computeExpectedTotals(
  records: Record<string, unknown>,
  nowMs?: number,
): Map<string, number>;
export function collectUnderscoreNames(
  records: Record<string, unknown>,
  nowMs?: number,
): string[];
