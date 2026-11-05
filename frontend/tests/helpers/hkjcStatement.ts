import { parseHkjcStatementHtml } from '../../src/bet/lib/hkjcImport';
import type { HkjcImportRow, HkjcParseResult } from '../../src/bet/types';

const DESKTOP_CLASS = 'ARResultTable print-table';

type RowCells = readonly [string, string, string, string, string, string, string, string];

export interface BetRowFixture {
  readonly transaction: string;
  readonly when: string;
  readonly betType: string;
  readonly detail: string;
  readonly debit: string;
  readonly credit: string;
}

export function row(cells: RowCells): string {
  return `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`;
}

export function betRow(fixture: BetRowFixture): string {
  return row([
    fixture.transaction,
    fixture.when,
    '',
    fixture.betType,
    fixture.detail,
    '',
    fixture.debit,
    fixture.credit,
  ]);
}

export function statement(rows: readonly string[], tableClass: string = DESKTOP_CLASS): string {
  return `<!doctype html><html><body>
    <table class="layout"><tr><td>ignore me</td></tr></table>
    <table class="${tableClass}" data-role="statement"><tbody>${rows.join('')}</tbody></table>
  </body></html>`;
}

export function parseRows(
  rows: readonly string[],
  tableClass: string = DESKTOP_CLASS,
): HkjcParseResult {
  return parseHkjcStatementHtml(statement(rows, tableClass));
}

export function firstRow(result: HkjcParseResult): HkjcImportRow {
  const [parsed] = result.rows;
  if (parsed === undefined) {
    throw new Error('expected the statement to produce at least one row');
  }
  return parsed;
}

export function pendingSingle(credit = ''): string {
  return betRow({
    transaction: '1001',
    when: '05/11/2026 20:15',
    betType: '入球大細',
    detail: 'FB1001 北港聯 對 南灣城 入球大細 大 [3.5 球] @ 2.07 $10',
    debit: '$10.00',
    credit,
  });
}

export const INFERENCE_CASES = [
  { name: 'push', payout: '$10.00', expected: 'push' },
  { name: 'half win', payout: '$14.65', expected: 'half_win' },
  { name: 'half loss', payout: '$5.00', expected: 'half_loss' },
] as const;

export const MARKET_CASES = [
  {
    transaction: '6001',
    name: '波膽',
    detail: 'FB6001 北港聯 對 南灣城 波膽 2:1 @ 8.50 $10',
    expected: {
      match: '北港聯 vs 南灣城',
      market: 'correct_score',
      selection: '2:1',
      odds: 8.5,
    },
  },
  {
    transaction: '6002',
    name: '客隊入球大細',
    detail: 'FB6002 北港聯 對 南灣城 客隊入球大細 細 [1.5 球] @ 1.88 $10',
    expected: {
      match: '北港聯 vs 南灣城',
      market: 'totals',
      selection: '細 [1.5 球]',
      odds: 1.88,
    },
  },
  {
    transaction: '6003',
    name: '開出角球大細',
    detail: 'FB6003 北港聯 對 南灣城 開出角球大細 大 [10.5 個] @ 1.90 $10',
    expected: {
      match: '北港聯 vs 南灣城',
      market: 'corner_totals',
      selection: '大 [10.5 個]',
      odds: 1.9,
    },
  },
] as const;
