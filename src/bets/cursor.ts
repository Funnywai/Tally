import { z } from 'zod';
import { isValidDateString } from '../time.js';

const cursorSchema = z.object({
  betDate: z.string().refine(isValidDateString),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export type BetCursor = z.infer<typeof cursorSchema>;

export function encodeBetCursor(cursor: BetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeBetCursor(value: string): BetCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const result = cursorSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
