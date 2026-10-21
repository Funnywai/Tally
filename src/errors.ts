export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INTERNAL';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  VALIDATION: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL: 500,
};

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: '未授權',
  VALIDATION: '輸入資料有誤',
  NOT_FOUND: '找不到資料',
  CONFLICT: '資料衝突',
  RATE_LIMITED: '嘗試次數過多，請稍後再試',
  UNSUPPORTED_MEDIA_TYPE: '只接受 application/json',
  PAYLOAD_TOO_LARGE: '請求內容過大',
  INTERNAL: '伺服器內部錯誤',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string = ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export interface ErrorBody {
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
  };
}

export function errorBody(code: ErrorCode, message: string = ERROR_MESSAGES[code]): ErrorBody {
  return { error: { code, message } };
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
