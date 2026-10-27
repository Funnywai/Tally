import { z } from 'zod';
import {
  computeTotalOdds,
  MAX_ODDS,
  MAX_STAKE,
  MAX_TOTAL_ODDS,
  MIN_ODDS,
  MIN_STAKE,
  round2,
} from './bets/profit.js';
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

function betTextSchema(max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => codePointLength(value) >= 1 && codePointLength(value) <= max, {
      message,
    })
    .refine((value) => !hasControlChar(value), { message: '不可包含控制字元' });
}

export const betMarketSchema = z.enum(['1x2', 'handicap', 'totals', 'other']);
export const betResultSchema = z.enum(['pending', 'win', 'half_win', 'push', 'half_loss', 'loss']);

const betOddsSchema = z
  .number()
  .refine(Number.isFinite, { message: '賠率必須是有限數字' })
  .refine((value) => value >= MIN_ODDS && value <= MAX_ODDS, {
    message: `賠率必須介乎 ${MIN_ODDS} 與 ${MAX_ODDS}`,
  })
  .transform(round2);

const betStakeSchema = z
  .number()
  .refine(Number.isFinite, { message: '注碼必須是有限數字' })
  .refine((value) => value >= MIN_STAKE && value <= MAX_STAKE, {
    message: `注碼必須介乎 ${MIN_STAKE} 與 ${MAX_STAKE}`,
  })
  .transform(round2);

export const betLegSchema = z.object({
  match: betTextSchema(80, '賽事必須為 1–80 個字元'),
  market: betMarketSchema,
  selection: betTextSchema(60, '選擇必須為 1–60 個字元'),
  odds: betOddsSchema,
});

function totalOddsIssue(
  legs: readonly { readonly odds: number }[],
): { readonly message: string } | null {
  if (computeTotalOdds(legs) > MAX_TOTAL_ODDS) {
    return { message: `總賠率不可超過 ${MAX_TOTAL_ODDS}` };
  }
  return null;
}

export const createBetSchema = z
  .object({
    date: dateSchema.optional(),
    stake: betStakeSchema,
    result: betResultSchema.default('pending'),
    legs: z.array(betLegSchema).min(1).max(8),
  })
  .superRefine((value, ctx) => {
    const issue = totalOddsIssue(value.legs);
    if (issue !== null) {
      ctx.addIssue({ code: 'custom', path: ['legs'], message: issue.message });
    }
  });

export const patchBetSchema = z
  .object({
    date: dateSchema.optional(),
    stake: betStakeSchema.optional(),
    result: betResultSchema.optional(),
    legs: z.array(betLegSchema).min(1).max(8).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.date === undefined &&
      value.stake === undefined &&
      value.result === undefined &&
      value.legs === undefined
    ) {
      ctx.addIssue({ code: 'custom', message: '至少需要提供一個欄位' });
    }
    if (value.legs !== undefined) {
      const issue = totalOddsIssue(value.legs);
      if (issue !== null) {
        ctx.addIssue({ code: 'custom', path: ['legs'], message: issue.message });
      }
    }
  });

export const listBetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
  status: z.enum(['all', 'pending', 'settled']).default('all'),
});

export const betStatsQuerySchema = z.object({
  period: z.enum(['month', 'year', 'all']).default('month'),
});

export const betIdSchema = z.uuid();

export type CreateBetInput = z.infer<typeof createBetSchema>;
export type PatchBetInput = z.infer<typeof patchBetSchema>;

export type CreateRecordInput = z.infer<typeof createRecordSchema>;
export type PatchRecordInput = z.infer<typeof patchRecordSchema>;
export type PatchPlayerInput = z.infer<typeof patchPlayerSchema>;

export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? '輸入資料有誤';
}
