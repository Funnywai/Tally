import { z } from 'zod';
import { isValidDateString } from './time.js';

export const MAX_NAME_CODE_POINTS = 7;
export const MIN_PATCH_PLAYERS = 2;
export const MAX_PATCH_PLAYERS = 8;

function hasControlChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

export function codePointLength(value: string): number {
  return [...value].length;
}

export const nameSchema = z
  .string()
  .trim()
  .refine(
    (value) => codePointLength(value) >= 1 && codePointLength(value) <= MAX_NAME_CODE_POINTS,
    { message: '名稱長度必須為 1–7 個字元' },
  )
  .refine((value) => !hasControlChar(value), { message: '名稱不可包含控制字元' });

export const MIN_SCORE = -999_999_999.9;
export const MAX_SCORE = 999_999_999.9;

export const scoreSchema = z
  .number()
  .refine(Number.isFinite, { message: '分數必須是有限數字' })
  .refine((value) => value >= MIN_SCORE && value <= MAX_SCORE, {
    message: `分數必須介於 ${MIN_SCORE} 與 ${MAX_SCORE} 之間`,
  });

export const dateSchema = z
  .string()
  .refine(isValidDateString, { message: '日期格式必須為 YYYY-MM-DD' });

export const createPlayerSchema = z.object({
  name: nameSchema,
  score: scoreSchema,
});

export const createRecordSchema = z
  .object({
    date: dateSchema.optional(),
    players: z.array(createPlayerSchema).length(4),
  })
  .superRefine((value, ctx) => {
    const names = value.players.map((player) => player.name);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['players'],
        message: '玩家名稱不可重複',
      });
    }
  });

export const patchPlayerSchema = z.object({
  playerId: z.uuid().nullish(),
  name: nameSchema,
  score: scoreSchema,
});

export const patchRecordSchema = z
  .object({
    date: dateSchema.optional(),
    players: z.array(patchPlayerSchema).min(MIN_PATCH_PLAYERS).max(MAX_PATCH_PLAYERS).optional(),
  })
  .refine((value) => value.date !== undefined || value.players !== undefined, {
    message: '至少需要提供 date 或 players',
  });

export const listRecordsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

export const statsQuerySchema = z.object({
  player: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((value) => !hasControlChar(value), { message: '名稱不可包含控制字元' }),
  year: z
    .string()
    .regex(/^\d{4}$/, { message: '年份格式必須為 YYYY' })
    .transform(Number)
    .refine((year) => year >= 1900 && year <= 2200, { message: '年份超出範圍' })
    .optional(),
});

export const authBodySchema = z.object({
  passcode: z.string().min(1).max(512),
});

export const recordIdSchema = z.uuid();

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type PatchRecordInput = z.infer<typeof patchRecordSchema>;
export type PatchPlayerInput = z.infer<typeof patchPlayerSchema>;

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? '輸入資料有誤';
}
