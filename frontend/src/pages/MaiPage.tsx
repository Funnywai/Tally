import { useState } from 'react';
import { FoodDialog } from '../components/FoodDialog';
import { LoaderIcon, UtensilsIcon } from '../components/Icons';
import { Numpad } from '../components/Numpad';
import { TallyMark } from '../components/TallyMark';
import { useToast } from '../components/ToastProvider';
import { createRecord, isApiError } from '../lib/api';
import { formatMoney, formatPlainScore, formatStatMoney } from '../lib/money';
import { round1 } from '../lib/scoring';
import { PLAYER_INDICES, type PlayerIndex } from '../lib/types';
import { useGame } from '../state/GameProvider';
import { useGameActions } from '../state/useGameActions';

const DIVISORS: readonly (2 | 3 | 4)[] = [4, 3, 2];
const PLAYER_ROWS: readonly (readonly PlayerIndex[])[] = [[1], [0, 2], [3]];

type DialogKind = 'none' | 'food';

export function MaiPage() {
  const { state } = useGame();
  const actions = useGameActions();
  const { showToast } = useToast();
  const [adjustIndex, setAdjustIndex] = useState<PlayerIndex | null>(null);
  const [dialog, setDialog] = useState<DialogKind>('none');
  const [writing, setWriting] = useState(false);

  const total = round1(state.accumulated.reduce((sum, value) => sum + value, 0));
  const balanced = total === 0;
  const divided = state.divided;
  const written = state.written;

  const write = async () => {
    if (writing || !divided || written || !balanced) {
      return;
    }
    const names = PLAYER_INDICES.map((index) => state.names[index].trim());
    if (new Set(names).size !== names.length) {
      showToast('名稱不可重複，請先改名。', 'error');
      return;
    }
    setWriting(true);
    try {
      await createRecord(
        PLAYER_INDICES.map((index) => ({
          name: state.names[index],
          score: state.accumulated[index],
        })),
      );
      actions.markWritten();
      showToast('已寫入小氣簿', 'success');
    } catch (caught: unknown) {
      showToast(isApiError(caught) ? caught.message : '寫入失敗，請再試一次。', 'error');
    } finally {
      setWriting(false);
    }
  };

  return (
    <section className="page page--mai" aria-labelledby="mai-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SETTLEMENT</p>
          <h1 id="mai-title" className="page-title">
            埋數
          </h1>
        </div>
        <div
          className={`balance-chip ${balanced ? 'is-balanced' : 'is-unbalanced'}`}
          role="status"
          aria-live="polite"
        >
          <span className="balance-chip__label">總和</span>
          <span className="balance-chip__value">{formatPlainScore(total)}</span>
          <span className="balance-chip__state">{balanced ? '已平' : '未平'}</span>
        </div>
      </div>

      <div className="player-grid">
        {PLAYER_ROWS.map((row) => (
          <div
            className={`player-grid__row ${row.length === 2 ? 'player-grid__row--split' : ''}`}
            key={row.join('-')}
          >
            {row.map((index) => {
              const value = state.accumulated[index];
              const isMe = index === 3;
              const tone = value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-zero';
              return (
                <button
                  key={index}
                  type="button"
                  className={`player-card ${isMe ? 'is-me' : ''} ${tone}`}
                  aria-label={
                    divided
                      ? `調整 ${state.names[index]} 的分數，目前 ${formatStatMoney(value)}`
                      : `調整 ${state.names[index]} 的分數，目前 ${formatPlainScore(value)} 分`
                  }
                  onClick={() => setAdjustIndex(index)}
                >
                  <span className="player-card__name">
                    {state.names[index]}
                    {isMe ? <span className="player-card__me">我</span> : null}
                  </span>
                  <span key={value} className="player-card__score">
                    {divided ? formatMoney(value) : formatPlainScore(value)}
                  </span>
                  {isMe ? <TallyMark size={72} className="player-card__watermark" /> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mai-actions">
        <fieldset className="divide-row" aria-label="除數">
          {DIVISORS.map((divisor) => (
            <button
              key={divisor}
              type="button"
              className="button button--outline"
              onClick={() => actions.divide(divisor)}
              disabled={divided || !balanced}
            >
              ÷{divisor}
            </button>
          ))}
        </fieldset>

        <button
          type="button"
          className="button button--outline button--block"
          onClick={() => setDialog('food')}
          disabled={!written}
        >
          <UtensilsIcon size={18} />
          計算飯錢
        </button>

        <button
          type="button"
          className="button button--primary button--block button--write"
          onClick={() => void write()}
          disabled={writing || !divided || written || !balanced}
        >
          {writing ? <LoaderIcon size={18} className="spin" /> : null}
          {writing ? '寫入中…' : '寫入小氣簿'}
        </button>
      </div>

      <Numpad
        open={adjustIndex !== null}
        mode="mai"
        title={adjustIndex === null ? '' : `${state.names[adjustIndex]} · 調整分數`}
        initialValue={adjustIndex === null ? 0 : state.accumulated[adjustIndex]}
        onClose={() => setAdjustIndex(null)}
        onConfirm={(value) => {
          if (adjustIndex !== null && value !== null) {
            actions.adjust(adjustIndex, value);
          }
          setAdjustIndex(null);
        }}
      />

      <FoodDialog
        open={dialog === 'food'}
        names={state.names}
        onClose={() => setDialog('none')}
        onConfirm={(paid, owed) => {
          actions.food(paid, owed);
          setDialog('none');
        }}
      />
    </section>
  );
}
