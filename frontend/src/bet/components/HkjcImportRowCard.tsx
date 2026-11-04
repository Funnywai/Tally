import { useId } from 'react';
import { formatDateLong } from '../../lib/date';
import { betTypeLabel, formatOdds, formatStake, marketLabel } from '../lib/format';
import type { BetImportStatus, BetResult, HkjcImportRow } from '../types';

const RESULT_OPTIONS: readonly { readonly id: BetResult; readonly label: string }[] = [
  { id: 'pending', label: '未開' },
  { id: 'win', label: '贏' },
  { id: 'half_win', label: '半贏' },
  { id: 'push', label: '走水' },
  { id: 'half_loss', label: '半輸' },
  { id: 'loss', label: '輸' },
];

interface HkjcImportRowCardProps {
  readonly row: HkjcImportRow;
  readonly status: BetImportStatus | null;
  readonly include: boolean;
  readonly result: BetResult;
  readonly onChangeInclude: (include: boolean) => void;
  readonly onChangeResult: (result: BetResult) => void;
}

export function HkjcImportRowCard({
  row,
  status,
  include,
  result,
  onChangeInclude,
  onChangeResult,
}: HkjcImportRowCardProps) {
  const checkboxId = useId();
  const resultId = useId();
  const duplicate = status === 'duplicate';
  const className = [
    'bet-import-card',
    include ? '' : 'is-excluded',
    duplicate ? 'is-duplicate' : '',
  ]
    .filter((part) => part !== '')
    .join(' ');

  return (
    <article className={className} aria-label={`${row.date} ${row.time} 注單`}>
      <div className="bet-import-card__top">
        <label className="bet-import-card__include" htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={include}
            disabled={duplicate}
            onChange={(event) => onChangeInclude(event.target.checked)}
          />
          <span>匯入</span>
        </label>
        <span className="bet-type">{betTypeLabel(row.legs.length)}</span>
        <span className="bet-import-card__when">
          {formatDateLong(row.date)} {row.time}
        </span>
        {duplicate ? <span className="bet-import-card__badge">已存在</span> : null}
      </div>

      {row.betType === '' ? null : <p className="bet-import-card__meta">{row.betType}</p>}

      <ul className="bet-import-card__legs">
        {row.legs.map((leg, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: parsed legs are positional and never reordered.
          <li className="bet-import-card__leg" key={index}>
            <span className="bet-import-card__leg-index">{String(index + 1).padStart(2, '0')}</span>
            <div className="bet-import-card__leg-body">
              <span className="bet-import-card__match">{leg.match}</span>
              <span className="bet-import-card__selection">
                {marketLabel(leg.market)} · {leg.selection}
              </span>
            </div>
            <span className="bet-import-card__odds">@ {formatOdds(leg.odds)}</span>
          </li>
        ))}
      </ul>

      <div className="bet-import-card__amounts">
        <span>注碼 {formatStake(row.stake)}</span>
        <span>派彩 {formatStake(row.payout)}</span>
      </div>

      <label className="bet-import-card__result" htmlFor={resultId}>
        <span className="bet-import-card__field-label">結果</span>
        <select
          id={resultId}
          className="bet-import-card__select"
          value={result}
          disabled={duplicate}
          onChange={(event) => {
            const next = RESULT_OPTIONS.find((option) => option.id === event.target.value);
            if (next !== undefined) {
              onChangeResult(next.id);
            }
          }}
        >
          {RESULT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {row.warnings.length === 0 ? null : (
        <ul className="bet-import-card__warnings">
          {row.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </article>
  );
}
