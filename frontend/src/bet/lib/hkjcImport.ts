import type { BetResult, HkjcImportRow, HkjcParseResult } from '../types';
import { formatBetMoney } from './format';
import { parseLegs } from './hkjcDetail';
import { extractRows, findStatementTable, isSkippableRow } from './hkjcHtml';
import { computeTotalOdds, round2 } from './profit';

interface RowRef {
  readonly rowNumber: number;
  readonly transaction: string;
}

interface ResultInference {
  readonly result: BetResult;
  readonly profitOverride: number | null;
  readonly warning: string | null;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function isValidDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parseDateTime(value: string): { readonly date: string; readonly time: string } | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const day = Number(match[1] ?? '');
  const month = Number(match[2] ?? '');
  const year = Number(match[3] ?? '');
  const hour = Number(match[4] ?? '');
  const minute = Number(match[5] ?? '');
  if (!isValidDate(year, month, day) || hour > 23 || minute > 59) {
    return null;
  }
  return {
    date: `${year}-${pad2(month)}-${pad2(day)}`,
    time: `${pad2(hour)}:${pad2(minute)}`,
  };
}

function parseAmount(value: string): number | null {
  const cleaned = value
    .replace(/\s+/g, '')
    .replace(/HK\$/gi, '')
    .replace(/\$/g, '')
    .replace(/,/g, '');
  if (cleaned === '' || !/^-?\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : null;
}

function inferResult(stake: number, payout: number, totalOdds: number): ResultInference {
  const roundedStake = round2(stake);
  const roundedPayout = round2(payout);
  if (roundedPayout === 0) {
    return { result: 'pending', profitOverride: null, warning: null };
  }
  if (roundedPayout === roundedStake) {
    return { result: 'push', profitOverride: null, warning: null };
  }
  if (roundedPayout === round2(roundedStake * totalOdds)) {
    return { result: 'win', profitOverride: null, warning: null };
  }
  const halfWinPayout = round2(roundedStake + (roundedStake * (totalOdds - 1)) / 2);
  if (roundedPayout === halfWinPayout) {
    return { result: 'half_win', profitOverride: null, warning: null };
  }
  if (roundedPayout === round2(roundedStake / 2)) {
    return { result: 'half_loss', profitOverride: null, warning: null };
  }
  const profitOverride = round2(roundedPayout - roundedStake);
  return {
    result: 'cash_out',
    profitOverride,
    warning: `派彩快：實際輸贏 ${formatBetMoney(profitOverride)}，已用實際派彩記錄`,
  };
}

function rowWarning(ref: RowRef, message: string): string {
  return `第 ${ref.rowNumber} 行（交易編號 ${ref.transaction}）：${message}`;
}

export function parseHkjcStatementHtml(html: string): HkjcParseResult {
  const tableHtml = findStatementTable(html);
  if (tableHtml === null) {
    return {
      rows: [],
      warnings: ['找不到 HKJC 帳戶結單表格（ARResultTable print-table）'],
    };
  }

  const rows: HkjcImportRow[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();
  let rowNumber = 0;

  for (const cells of extractRows(tableHtml)) {
    rowNumber += 1;
    if (cells.length < 8) {
      continue;
    }
    const transaction = cells[0] ?? '';
    const dateTimeText = cells[1] ?? '';
    const betType = cells[3] ?? '';
    const detail = cells[4] ?? '';
    const debitText = cells[6] ?? '';
    const creditText = cells[7] ?? '';

    if (transaction === '' || isSkippableRow(cells)) {
      continue;
    }
    if (!/FB\s*\d+/i.test(detail)) {
      continue;
    }

    const ref = { rowNumber, transaction };
    const dateTime = parseDateTime(dateTimeText);
    if (dateTime === null) {
      warnings.push(rowWarning(ref, '日期時間無法解析，已略過'));
      continue;
    }
    const stake = parseAmount(debitText);
    if (stake === null || stake <= 0) {
      warnings.push(rowWarning(ref, '注碼為零或無法解析，已略過'));
      continue;
    }
    const payoutValue = parseAmount(creditText);
    if (payoutValue === null && creditText !== '') {
      warnings.push(rowWarning(ref, '派彩金額無法解析，已略過'));
      continue;
    }
    const legs = parseLegs(detail);
    if (legs === null) {
      warnings.push(rowWarning(ref, '詳情無法解析，已略過'));
      continue;
    }
    const externalId = `hkjc:${dateTime.date}:${transaction}`;
    if (seen.has(externalId)) {
      warnings.push(rowWarning(ref, '同一交易編號重複，已保留第一筆'));
      continue;
    }

    const payout = payoutValue ?? 0;
    const inference = inferResult(stake, payout, computeTotalOdds(legs));
    const rowWarnings = inference.warning === null ? [] : [inference.warning];
    if (inference.warning !== null) {
      warnings.push(rowWarning(ref, inference.warning));
    }
    seen.add(externalId);
    rows.push({
      externalId,
      date: dateTime.date,
      time: dateTime.time,
      stake: round2(stake),
      payout: round2(payout),
      result: inference.result,
      profitOverride: inference.profitOverride,
      legs,
      betType,
      detail,
      warnings: rowWarnings,
    });
  }

  return { rows, warnings };
}
