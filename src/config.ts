import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    TZ: z.literal('Asia/Hong_Kong').default('Asia/Hong_Kong'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    APP_PASSCODE: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    COOKIE_SECURE: booleanString.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.APP_PASSCODE.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_PASSCODE'],
        message: 'APP_PASSCODE must be at least 32 characters in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production (HTTPS is provided by Cloudflare)',
      });
    }
    if (env.APP_PASSCODE === env.SESSION_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'SESSION_SECRET must differ from APP_PASSCODE',
      });
    }
  });

export type NodeEnv = 'development' | 'test' | 'production';
export type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';

export interface AppConfig {
  readonly nodeEnv: NodeEnv;
  readonly port: number;
  readonly timeZone: 'Asia/Hong_Kong';
  readonly logLevel: LogLevel;
  readonly databaseUrl: string;
  readonly appPasscode: string;
  readonly sessionSecret: string;
  readonly cookieSecure: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  return Object.freeze({
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    timeZone: parsed.data.TZ,
    logLevel: parsed.data.LOG_LEVEL,
    databaseUrl: parsed.data.DATABASE_URL,
    appPasscode: parsed.data.APP_PASSCODE,
    sessionSecret: parsed.data.SESSION_SECRET,
    cookieSecure: parsed.data.COOKIE_SECURE,
  });
}
