import { z } from 'zod';
import { isValidDateString } from '../time.js';

const cursorSchema = z.object({
  playedAt: z.string().refine(isValidDateString),
  recordedAt: z.iso.datetime(),
  id: z.uuid(),
});

export type RecordCursor = z.infer<typeof cursorSchema>;

export function encodeCursor(cursor: RecordCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(value: string): RecordCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const result = cursorSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
