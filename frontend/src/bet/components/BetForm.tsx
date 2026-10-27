import { type FormEvent, useId, useState } from 'react';
import { parseDraft } from '../lib/form';
import { formatBetMoney, formatStake } from '../lib/format';
import { computePotentialReturn, computeProfit } from '../lib/profit';
import type { BetDraft, BetMarket, BetPayload, BetResult } from '../types';
import { BetLoaderIcon, BetPlusIcon, BetTrashIcon } from './BetIcons';
import { BetSheet } from './BetSheet';

const MARKETS: readonly { id: BetMarket; label: string }[] = [
  { id: '1x2', label: '主客和' },
  { id: 'handicap', label: '讓球' },
  { id: 'totals', label: '大細' },
  { id: 'other', label: '其他' },
];

const RESULTS: readonly { id: BetResult; label: string }[] = [
  { id: 'pending', label: '未開' },
  { id: 'win', label: '贏' },
  { id: 'half_win', label: '半贏' },
  { id: 'push', label: '走水' },
  { id: 'half_loss', label: '半輸' },
  { id: 'loss', label: '輸' },
];

interface BetFormProps {
  readonly mode: 'create' | 'edit';
  readonly initial: BetDraft;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSave: (payload: BetPayload) => void;
  readonly onDelete?: (() => void) | undefined;
}

export function BetForm({ mode, initial, saving, error, onClose, onSave, onDelete }: BetFormProps) {
  const [draft, setDraft] = useState<BetDraft>(initial);
  const [attempted, setAttempted] = useState(false);
  const formId = useId();
  const parsed = parseDraft(draft);

  const errorId = (field: string) => `${formId}-${field}-error`;
  const showError = (message: string | undefined, field: string) =>
    attempted && message !== undefined ? (
      <span id={errorId(field)} className="bet-field__error" role="alert">
        {message}
      </span>
    ) : null;
  const invalidProps = (message: string | undefined, field: string) =>
    attempted && message !== undefined
      ? { 'aria-invalid': true, 'aria-describedby': errorId(field) }
      : {};

  const updateLeg = (index: number, patch: Partial<BetDraft['legs'][number]>) => {
    setDraft((current) => ({
      ...current,
      legs: current.legs.map((leg, legIndex) => (legIndex === index ? { ...leg, ...patch } : leg)),
    }));
  };

  const addLeg = () => {
    if (draft.legs.length >= 8) {
      return;
    }
    setDraft((current) => ({
      ...current,
      legs: [...current.legs, { match: '', market: '1x2', selection: '', odds: '' }],
    }));
  };

  const removeLeg = (index: number) => {
    if (draft.legs.length <= 1) {
      return;
    }
    setDraft((current) => ({
      ...current,
      legs: current.legs.filter((_, legIndex) => legIndex !== index),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (parsed.payload === null || saving) {
      return;
    }
    onSave(parsed.payload);
  };

  const stakeValue = Number(draft.stake);
  const validStake = parsed.errors.stake === undefined;
  const previewProfit =
    parsed.totalOdds !== null && validStake
      ? computeProfit(stakeValue, parsed.totalOdds, draft.result)
      : null;
  const potentialReturn =
    parsed.totalOdds !== null && validStake
      ? computePotentialReturn(stakeValue, parsed.totalOdds)
      : null;

  return (
    <BetSheet
      open
      full
      title={mode === 'create' ? '新增注單' : '編輯注單'}
      onClose={onClose}
      footer={
        <>
          {onDelete === undefined ? null : (
            <button
              type="button"
              className="bet-button bet-button--danger-ghost"
              onClick={onDelete}
              disabled={saving}
            >
              <BetTrashIcon size={15} />
              刪除
            </button>
          )}
          <div className="bet-sheet__footer-spacer" />
          <button
            type="button"
            className="bet-button bet-button--ghost"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="submit"
            form={formId}
            className="bet-button bet-button--primary"
            disabled={saving}
          >
            {saving ? <BetLoaderIcon size={16} className="bet-spin" /> : null}
            {saving ? '儲存中…' : '儲存'}
          </button>
        </>
      }
    >
      <form id={formId} className="bet-form" onSubmit={handleSubmit} noValidate>
        {error === null ? null : (
          <p className="bet-form__server-error" role="alert">
            {error}
          </p>
        )}

        <label className="bet-field">
          <span className="bet-field__label">日期</span>
          <input
            type="date"
            className="bet-field__input"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            required
            {...invalidProps(parsed.errors.date, 'date')}
          />
          {showError(parsed.errors.date, 'date')}
        </label>

        <div className="bet-form__legs">
          {draft.legs.map((leg, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: draft legs are positional rows edited in place; rows are never reordered.
            <fieldset className="bet-leg-form" key={index}>
              <legend className="bet-leg-form__legend">
                第 {index + 1} 場
                {draft.legs.length > 1 ? (
                  <button
                    type="button"
                    className="bet-leg-form__remove"
                    onClick={() => removeLeg(index)}
                    aria-label={`移除第 ${index + 1} 場`}
                  >
                    <BetTrashIcon size={14} />
                    移除
                  </button>
                ) : null}
              </legend>

              <label className="bet-field">
                <span className="bet-field__label">賽事</span>
                <input
                  className="bet-field__input"
                  value={leg.match}
                  onChange={(event) => updateLeg(index, { match: event.target.value })}
                  placeholder="曼聯 vs 車路士"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={80}
                  required
                  {...invalidProps(parsed.errors.legs[index]?.match, `leg-${index}-match`)}
                />
                {showError(parsed.errors.legs[index]?.match, `leg-${index}-match`)}
              </label>

              <fieldset className="bet-market-chips" aria-label={`第 ${index + 1} 場盤口`}>
                {MARKETS.map((market) => (
                  <button
                    key={market.id}
                    type="button"
                    className={`bet-chip ${leg.market === market.id ? 'is-selected' : ''}`}
                    aria-pressed={leg.market === market.id}
                    onClick={() => updateLeg(index, { market: market.id })}
                  >
                    {market.label}
                  </button>
                ))}
              </fieldset>

              <label className="bet-field">
                <span className="bet-field__label">選擇</span>
                <input
                  className="bet-field__input"
                  value={leg.selection}
                  onChange={(event) => updateLeg(index, { selection: event.target.value })}
                  placeholder="曼聯 -0.5"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={60}
                  required
                  {...invalidProps(parsed.errors.legs[index]?.selection, `leg-${index}-selection`)}
                />
                {showError(parsed.errors.legs[index]?.selection, `leg-${index}-selection`)}
              </label>

              <label className="bet-field">
                <span className="bet-field__label">賠率</span>
                <input
                  className="bet-field__input bet-field__input--number"
                  value={leg.odds}
                  onChange={(event) => updateLeg(index, { odds: event.target.value })}
                  placeholder="1.95"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                  {...invalidProps(parsed.errors.legs[index]?.odds, `leg-${index}-odds`)}
                />
                {showError(parsed.errors.legs[index]?.odds, `leg-${index}-odds`)}
              </label>
            </fieldset>
          ))}

          <button
            type="button"
            className="bet-button bet-button--outline bet-button--block"
            onClick={addLeg}
            disabled={draft.legs.length >= 8}
          >
            <BetPlusIcon size={15} />
            {draft.legs.length >= 8 ? '最多 8 場' : '加一場'}
          </button>

          {attempted && parsed.errors.legsCount !== undefined ? (
            <p className="bet-field__error" role="alert">
              {parsed.errors.legsCount}
            </p>
          ) : null}
        </div>

        <div className="bet-total-odds">
          <span className="bet-total-odds__label">總賠率</span>
          <span className="bet-total-odds__value">
            {parsed.totalOdds === null ? '—' : parsed.totalOdds.toFixed(2)}
          </span>
          {showError(parsed.errors.totalOdds, 'total-odds')}
        </div>

        <label className="bet-field">
          <span className="bet-field__label">注碼</span>
          <input
            className="bet-field__input bet-field__input--number"
            value={draft.stake}
            onChange={(event) => setDraft((current) => ({ ...current, stake: event.target.value }))}
            placeholder="500"
            inputMode="decimal"
            autoComplete="off"
            required
            {...invalidProps(parsed.errors.stake, 'stake')}
          />
          {showError(parsed.errors.stake, 'stake')}
        </label>

        <div className="bet-form__result">
          <span className="bet-field__label">結果</span>
          <fieldset className="bet-result-chips" aria-label="投注結果">
            {RESULTS.map((result) => (
              <button
                key={result.id}
                type="button"
                className={`bet-chip ${draft.result === result.id ? 'is-selected' : ''}`}
                aria-pressed={draft.result === result.id}
                onClick={() => setDraft((current) => ({ ...current, result: result.id }))}
              >
                {result.label}
              </button>
            ))}
          </fieldset>
        </div>

        <div className="bet-preview" aria-live="polite">
          <span className="bet-preview__label">
            {draft.result === 'pending' ? '待結算' : '輸贏預覽'}
          </span>
          <span
            className={`bet-preview__value ${
              draft.result === 'pending'
                ? 'is-pending'
                : previewProfit !== null && previewProfit > 0
                  ? 'is-win'
                  : previewProfit !== null && previewProfit < 0
                    ? 'is-loss'
                    : 'is-zero'
            }`}
          >
            {draft.result === 'pending'
              ? potentialReturn === null
                ? '—'
                : `潛在回報 ${formatStake(potentialReturn)}`
              : previewProfit === null
                ? '—'
                : formatBetMoney(previewProfit)}
          </span>
        </div>
      </form>
    </BetSheet>
  );
}
