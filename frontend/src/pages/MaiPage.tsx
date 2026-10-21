import { useState } from 'react';
import { FoodDialog } from '../components/FoodDialog';
import { LoaderIcon, SparkIcon, UtensilsIcon } from '../components/Icons';
import { Numpad } from '../components/Numpad';
import { SpecialDialog } from '../components/SpecialDialog';
import { TallyMark } from '../components/TallyMark';
import { useToast } from '../components/ToastProvider';
import { createRecord, isApiError } from '../lib/api';
import { formatMoney, formatStatMoney } from '../lib/money';
import { PLAYER_INDICES, type PlayerIndex } from '../lib/types';
import { useGame } from '../state/GameProvider';
import { useGameActions } from '../state/useGameActions';

const DIVISORS: readonly (2 | 3 | 4)[] = [4, 3, 2];

type DialogKind = 'none' | 'special' | 'food';

export function MaiPage() {
  const { state } = useGame();
  const actions = useGameActions();
  const { showToast } = useToast();
  const [adjustIndex, setAdjustIndex] = useState<PlayerIndex | null>(null);
  const [dialog, setDialog] = useState<DialogKind>('none');
  const [writing, setWriting] = useState(false);

  const write = async () => {
    if (writing) {
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
        <p className="page-hint">點卡片調整</p>
      </div>

      <div className="player-grid">
        {PLAYER_INDICES.map((index) => {
          const value = state.accumulated[index];
          const isMe = index === 3;
          const tone = value > 0 ? 'is-positive' : value < 0 ? 'is-negative' : 'is-zero';
          return (
            <button
              key={index}
              type="button"
              className={`player-card ${isMe ? 'is-me' : ''} ${tone}`}
              aria-label={`調整 ${state.names[index]} 的分數，目前 ${formatStatMoney(value)}`}
              onClick={() => setAdjustIndex(index)}
            >
              <span className="player-card__name">
                {state.names[index]}
                {isMe ? <span className="player-card__me">我</span> : null}
              </span>
              <span key={value} className="player-card__score">
                {formatMoney(value)}
              </span>
              <span className="player-card__hint">點擊調整</span>
              {isMe ? <TallyMark size={72} className="player-card__watermark" /> : null}
            </button>
          );
        })}
      </div>

      <div className="mai-actions">
        <fieldset className="divide-row" aria-label="除數">
          {DIVISORS.map((divisor) => (
            <button
              key={divisor}
              type="button"
              className="button button--outline"
              onClick={() => actions.divide(divisor)}
            >
              ÷{divisor}
            </button>
          ))}
        </fieldset>

        <div className="mai-actions__pair">
          <button
            type="button"
            className="button button--outline"
            onClick={() => setDialog('special')}
          >
            <SparkIcon size={18} />
            特別賞罰
          </button>
          <button
            type="button"
            className="button button--outline"
            onClick={() => setDialog('food')}
          >
            <UtensilsIcon size={18} />
            計算飯錢
          </button>
        </div>

        <button
          type="button"
          className="button button--primary button--block button--write"
          onClick={() => void write()}
          disabled={writing}
        >
          {writing ? <LoaderIcon size={18} className="spin" /> : null}
          {writing ? '寫入中…' : '寫入小氣簿'}
        </button>
      </div>

      <p className="page-footnote">所有埋數操作都可復原 · 寫入後以小氣簿為準</p>

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

      <SpecialDialog
        open={dialog === 'special'}
        names={state.names}
        onClose={() => setDialog('none')}
        onConfirm={(index, kind, score) => {
          actions.special(index, kind, score);
          setDialog('none');
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
