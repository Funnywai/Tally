import { describe, expect, it } from 'vitest';
import { parseHkjcStatementHtml } from '../src/bet/lib/hkjcImport';
import { computeTotalOdds } from '../src/bet/lib/profit';
import {
  betRow,
  firstRow,
  INFERENCE_CASES,
  MARKET_CASES,
  parseRows,
  pendingSingle,
  row,
} from './helpers/hkjcStatement';

describe('parseHkjcStatementHtml singles', () => {
  it('parses a pending single and maps the market, selection, and odds', () => {
    const result = parseRows([
      betRow({
        transaction: '<span>1001</span>',
        when: '05/11/2026&nbsp;20:15',
        betType: '入球大細',
        detail:
          'FB1001&nbsp;北港聯&nbsp;對&nbsp;南灣城&nbsp;入球大細&nbsp;大&nbsp;[3.5&nbsp;球]&nbsp;@&nbsp;2.07&nbsp;$10',
        debit: '$10.00',
        credit: '',
      }),
    ]);

    expect(result.warnings).toEqual([]);
    expect(result.rows).toHaveLength(1);

    const parsed = firstRow(result);
    expect(parsed.externalId).toBe('hkjc:2026-11-05:1001');
    expect(parsed.date).toBe('2026-11-05');
    expect(parsed.time).toBe('20:15');
    expect(parsed.stake).toBe(10);
    expect(parsed.payout).toBe(0);
    expect(parsed.result).toBe('pending');
    expect(parsed.profitOverride).toBeNull();
    expect(parsed.betType).toBe('入球大細');
    expect(parsed.detail).toContain('FB1001');
    expect(parsed.legs).toEqual([
      {
        match: '北港聯 vs 南灣城',
        market: 'totals',
        selection: '大 [3.5 球]',
        odds: 2.07,
      },
    ]);
    expect(parsed.warnings).toEqual([]);
  });

  it('infers a win when the payout equals stake times total odds', () => {
    const result = parseRows([
      betRow({
        transaction: '2002',
        when: '05/11/2026 20:30',
        betType: '主客和',
        detail: 'FB2002 北港聯 對 南灣城 主客和 主 @ 1.93 $10',
        debit: '$10.00',
        credit: '$19.30',
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.result).toBe('win');
    expect(parsed.profitOverride).toBeNull();
    expect(parsed.payout).toBe(19.3);
    expect(parsed.legs).toEqual([
      { match: '北港聯 vs 南灣城', market: '1x2', selection: '主', odds: 1.93 },
    ]);
  });

  it('accepts comma-grouped amounts', () => {
    const result = parseRows([
      betRow({
        transaction: '9001',
        when: '06/11/2026 19:00',
        betType: '主客和',
        detail: 'FB9001 北港聯 對 南灣城 主客和 主 @ 2.00 $1,234.56',
        debit: '$1,234.56',
        credit: '$2,469.12',
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.stake).toBe(1234.56);
    expect(parsed.payout).toBe(2469.12);
    expect(parsed.result).toBe('win');
  });
});

describe('parseHkjcStatementHtml parlays', () => {
  it('parses two legs in order and computes the total odds', () => {
    const result = parseRows([
      betRow({
        transaction: '3001',
        when: '05/11/2026 21:00',
        betType: '過關 主客和 2x1',
        detail:
          'FB3001 東岸隊 對 西岸隊 主客和 主 @ 1.93 $10 FB3002 南港隊 對 北灣隊 入球大細 大 [2.5 球] @ 2.10 $10',
        debit: '$10.00',
        credit: '$40.50',
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.result).toBe('win');
    expect(parsed.legs).toEqual([
      { match: '東岸隊 vs 西岸隊', market: '1x2', selection: '主', odds: 1.93 },
      {
        match: '南港隊 vs 北灣隊',
        market: 'totals',
        selection: '大 [2.5 球]',
        odds: 2.1,
      },
    ]);
    expect(computeTotalOdds(parsed.legs)).toBe(4.05);
  });
});

describe('parseHkjcStatementHtml result inference', () => {
  it.each(INFERENCE_CASES)('infers $name from the payout', ({ payout, expected }) => {
    const result = parseRows([
      betRow({
        transaction: '4001',
        when: '05/11/2026 21:15',
        betType: '主客和',
        detail: 'FB4001 北港聯 對 南灣城 主客和 主 @ 1.93 $10',
        debit: '$10.00',
        credit: payout,
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.result).toBe(expected);
    expect(parsed.profitOverride).toBeNull();
    expect(parsed.warnings).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('records a cash-out win with the actual profit override', () => {
    const result = parseRows([
      betRow({
        transaction: '4101',
        when: '05/11/2026 21:25',
        betType: '主客和',
        detail: 'FB4101 北港聯 對 南灣城 主客和 主 @ 9.24 $10',
        debit: '$10.00',
        credit: '$17.30',
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.result).toBe('cash_out');
    expect(parsed.profitOverride).toBe(7.3);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings.join(' ')).toContain('派彩快');
    expect(result.warnings.join(' ')).toContain('派彩快');
  });

  it('records a cash-out loss with a negative profit override', () => {
    const result = parseRows([
      betRow({
        transaction: '4102',
        when: '05/11/2026 21:30',
        betType: '主客和',
        detail: 'FB4102 北港聯 對 南灣城 主客和 主 @ 2.96 $10',
        debit: '$10.00',
        credit: '$0.10',
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.result).toBe('cash_out');
    expect(parsed.profitOverride).toBe(-9.9);
    expect(parsed.warnings.join(' ')).toContain('派彩快');
    expect(result.warnings.join(' ')).toContain('派彩快');
  });

  it('treats an unmatched payout as cash_out instead of defaulting to win', () => {
    const result = parseRows([
      betRow({
        transaction: '4002',
        when: '05/11/2026 21:20',
        betType: '主客和',
        detail: 'FB4002 北港聯 對 南灣城 主客和 主 @ 1.93 $10',
        debit: '$10.00',
        credit: '$99.00',
      }),
    ]);

    const parsed = firstRow(result);
    expect(parsed.result).toBe('cash_out');
    expect(parsed.profitOverride).toBe(89);
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings.join(' ')).toContain('派彩快');
    expect(result.warnings.join(' ')).toContain('派彩快');
  });
});

describe('parseHkjcStatementHtml table selection', () => {
  it('uses the first desktop table and ignores the mobile duplicate', () => {
    const mobile = betRow({
      transaction: '4999',
      when: '05/11/2026 22:00',
      betType: '主客和',
      detail: 'FB4999 東岸隊 對 西岸隊 主客和 客 @ 2.50 $10',
      debit: '$10.00',
      credit: '',
    });
    const desktop = betRow({
      transaction: '5001',
      when: '05/11/2026 22:05',
      betType: '主客和',
      detail: 'FB5001 北港聯 對 南灣城 主客和 主 @ 1.95 $10',
      debit: '$10.00',
      credit: '',
    });
    const html = `<!doctype html><html><body>
      <table class="ARResultTable mobile"><tbody>${mobile}</tbody></table>
      <table class="print-table   ARResultTable" data-role="desktop"><tbody>${desktop}</tbody></table>
    </body></html>`;

    const result = parseHkjcStatementHtml(html);

    expect(result.rows).toHaveLength(1);
    expect(firstRow(result).externalId).toBe('hkjc:2026-11-05:5001');
  });

  it('skips header, balance, and end rows without noisy warnings', () => {
    const result = parseRows([
      row(['交易編號', '日期', '賽日', '類型', '詳情', '收據', '支出', '存入']),
      row(['', '', '', '', '之戶口結餘', '', '', '$100.00']),
      row(['- 完 -', '', '', '', '', '', '', '']),
      pendingSingle(),
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.warnings).toEqual([]);
    expect(firstRow(result).externalId).toBe('hkjc:2026-11-05:1001');
  });
});

describe('parseHkjcStatementHtml market mapping', () => {
  it.each(MARKET_CASES)('maps $name', ({ transaction, name, detail, expected }) => {
    const parsed = firstRow(
      parseRows([
        betRow({
          transaction,
          when: '05/11/2026 22:10',
          betType: name,
          detail,
          debit: '$10.00',
          credit: '',
        }),
      ]),
    );

    expect(parsed.legs).toEqual([expected]);
  });

  it('maps a 同場過關 combined bet to one other leg without splitting it', () => {
    const parsed = firstRow(
      parseRows([
        betRow({
          transaction: '6101',
          when: '05/11/2026 22:15',
          betType: '同場過關',
          detail: 'FB1001 Alpha 對 Beta 同場過關 4. Alpha勝 & 總入球多於[2.5]球 @ 5.10 $10',
          debit: '$10.00',
          credit: '',
        }),
      ]),
    );

    expect(parsed.legs).toEqual([
      {
        match: 'Alpha vs Beta',
        market: 'other',
        selection: '4. Alpha勝 & 總入球多於[2.5]球',
        odds: 5.1,
      },
    ]);
  });

  it('maps an 任何時間入球球員 selection to one other leg', () => {
    const parsed = firstRow(
      parseRows([
        betRow({
          transaction: '6102',
          when: '05/11/2026 22:20',
          betType: '任何時間入球球員',
          detail: 'FB1002 Gamma 對 Delta 任何時間入球球員 201 Player One @ 2.04 $10',
          debit: '$10.00',
          credit: '',
        }),
      ]),
    );

    expect(parsed.legs).toEqual([
      {
        match: 'Gamma vs Delta',
        market: 'other',
        selection: '201 Player One',
        odds: 2.04,
      },
    ]);
  });

  it('still rejects a genuinely unknown market label', () => {
    const result = parseRows([
      betRow({
        transaction: '6103',
        when: '05/11/2026 22:25',
        betType: '未來市場',
        detail: 'FB1003 Gamma 對 Delta 未來市場 選項 @ 2.50 $10',
        debit: '$10.00',
        credit: '',
      }),
    ]);

    expect(result.rows).toEqual([]);
    expect(result.warnings).toHaveLength(1);
  });
});

describe('parseHkjcStatementHtml bad input', () => {
  it('skips a malformed detail row and warns instead of throwing', () => {
    const result = parseRows([
      betRow({
        transaction: '7001',
        when: '05/11/2026 22:20',
        betType: '入球大細',
        detail: 'FB7001 北港聯 對 南灣城 入球大細 大 [3.5 球] $10',
        debit: '$10.00',
        credit: '',
      }),
    ]);

    expect(result.rows).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('詳情無法解析');
    expect(result.warnings.join(' ')).toContain('7001');
  });

  it('keeps the first row when an external id repeats', () => {
    const duplicate = betRow({
      transaction: '8001',
      when: '05/11/2026 22:25',
      betType: '主客和',
      detail: 'FB8001 北港聯 對 南灣城 主客和 客 @ 3.00 $10',
      debit: '$10.00',
      credit: '',
    });
    const result = parseRows([
      betRow({
        transaction: '8001',
        when: '05/11/2026 22:25',
        betType: '主客和',
        detail: 'FB8001 北港聯 對 南灣城 主客和 主 @ 2.00 $10',
        debit: '$10.00',
        credit: '',
      }),
      duplicate,
    ]);

    expect(result.rows).toHaveLength(1);
    expect(firstRow(result).legs[0]?.odds).toBe(2);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('重複');
  });

  it('returns an empty result with a warning when no statement table exists', () => {
    const result = parseHkjcStatementHtml(
      '<!doctype html><html><body><table class="layout"><tr><td>無</td></tr></table></body></html>',
    );

    expect(result.rows).toEqual([]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings.join(' ')).toContain('ARResultTable');
  });
});
