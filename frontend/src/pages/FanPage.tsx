import { useEffect, useRef, useState } from 'react';
import { NameInput } from '../components/NameInput';
import { Numpad } from '../components/Numpad';
import { COLUMN_INDICES, type ColumnIndex } from '../lib/types';
import { useGame } from '../state/GameProvider';
import { useGameActions } from '../state/useGameActions';

const ROW_KEYS = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7'] as const;

function OutputValue({ value, tone }: { readonly value: number; readonly tone: string }) {
  const previous = useRef(value);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (previous.current === value) {
      return;
    }
    previous.current = value;
    setFlashing(true);
    const timer = window.setTimeout(() => setFlashing(false), 340);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <span className={`output-tile__value ${tone} ${flashing ? 'is-flashing' : ''}`}>{value}</span>
  );
}

interface ActiveCell {
  readonly column: ColumnIndex;
  readonly row: number;
}

export function FanPage() {
  const { state } = useGame();
  const actions = useGameActions();
  const [active, setActive] = useState<ActiveCell | null>(null);

  const activeValue = active === null ? null : (state.inputs[active.column][active.row] ?? null);
  const activeName = active === null ? '' : state.names[active.column];

  return (
    <section className="page page--fan" aria-labelledby="fan-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ROUND SCORE</p>
          <h1 id="fan-title" className="page-title">
            番數記錄
          </h1>
        </div>
      </div>

      <div className="fan-table">
        <div className="fan-names">
          {COLUMN_INDICES.map((column) => (
            <NameInput
              key={column}
              value={state.names[column]}
              label={`閒 ${column + 1} 名稱`}
              onCommit={(name) => actions.setName(column, name)}
            />
          ))}
        </div>

        <div className="fan-outputs">
          {COLUMN_INDICES.map((column) => {
            const output = state.outputs[column];
            const tone = output < 0 ? 'is-negative' : output === 0 ? 'is-zero' : '';
            return (
              <div key={column} className={`output-tile ${state.tikai[column] ? 'is-tikai' : ''}`}>
                <span className="output-tile__label">
                  {state.tikai[column] ? '已踢半' : '輸出'}
                </span>
                <OutputValue value={output} tone={tone} />
              </div>
            );
          })}
        </div>

        <div className="fan-actions">
          {COLUMN_INDICES.map((column) => (
            <div key={column} className="fan-actions__col">
              <button
                type="button"
                className="button button--small button--outline"
                disabled={state.tikai[column]}
                onClick={() => actions.tikai(column)}
              >
                {state.tikai[column] ? '已踢半' : '踢半'}
              </button>
              <button
                type="button"
                className="button button--small button--positive"
                onClick={() => actions.zhao(column)}
              >
                找數
              </button>
            </div>
          ))}
        </div>

        <fieldset className="fan-grid" aria-label="番數輸入，3 欄 7 列">
          {ROW_KEYS.map((rowKey, row) =>
            COLUMN_INDICES.map((column) => {
              const value = state.inputs[column][row] ?? null;
              const isActive = active !== null && active.column === column && active.row === row;
              const classes = [
                'input-cell',
                value === null ? 'is-empty' : '',
                value !== null && value < 0 ? 'is-negative' : '',
                isActive ? 'is-active' : '',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={`${column}-${rowKey}`}
                  type="button"
                  className={classes}
                  aria-label={`${state.names[column]} 第 ${row + 1} 行，${value === null ? '空白' : value}`}
                  onClick={() => setActive({ column, row })}
                >
                  {value === null ? '—' : value}
                </button>
              );
            }),
          )}
        </fieldset>
      </div>

      <Numpad
        open={active !== null}
        mode="fan"
        title={active === null ? '' : `${activeName} · 第 ${active.row + 1} 行`}
        initialValue={activeValue}
        onClose={() => setActive(null)}
        onConfirm={(value) => {
          if (active !== null) {
            actions.setCell(active.column, active.row, value);
          }
          setActive(null);
        }}
      />
    </section>
  );
}
