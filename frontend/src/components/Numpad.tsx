import { useEffect, useState } from 'react';
import { round1 } from '../lib/scoring';
import { BackspaceIcon, CheckIcon, MinusIcon, PlusIcon } from './Icons';
import { DIGIT_ROWS, formatNumber, type KeyDef, keyAria, keyLabel } from './numpadKeys';
import { Sheet } from './Sheet';

type NumpadMode = 'fan' | 'mai';

interface NumpadProps {
  readonly open: boolean;
  readonly mode: NumpadMode;
  readonly title: string;
  readonly initialValue: number | null;
  readonly onClose: () => void;
  readonly onConfirm: (value: number | null) => void;
}

export function Numpad({ open, mode, title, initialValue, onClose, onConfirm }: NumpadProps) {
  const [entry, setEntry] = useState('');
  const [negative, setNegative] = useState(false);
  const [accum, setAccum] = useState<number | null>(null);
  const [op, setOp] = useState<'+' | '-' | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'fan') {
      setEntry(initialValue === null ? '' : String(Math.abs(initialValue)));
      setNegative(initialValue !== null && initialValue < 0);
      setAccum(null);
      setOp(null);
      return;
    }
    setEntry('');
    setNegative(false);
    setAccum(initialValue ?? 0);
    setOp(null);
  }, [open, mode, initialValue]);

  const computeResult = (): number => {
    const base = accum ?? 0;
    if (op === null) {
      if (entry === '' || entry === '.') {
        return base;
      }
      return Number.parseFloat(entry);
    }
    if (entry === '' || entry === '.') {
      return base;
    }
    const value = Number.parseFloat(entry);
    return op === '+' ? base + value : base - value;
  };

  const display = (): string => {
    if (mode === 'fan') {
      const shown = entry === '' ? '0' : entry;
      return `${negative && shown !== '0' ? '-' : ''}${shown}`;
    }
    const parts: string[] = [];
    if (accum !== null) {
      parts.push(formatNumber(accum));
    }
    if (op !== null) {
      parts.push(op);
    }
    if (entry !== '') {
      parts.push(entry);
    }
    return parts.length === 0 ? '0' : parts.join(' ');
  };

  const preview = mode === 'mai' ? round1(computeResult()) : 0;

  const press = (key: KeyDef): void => {
    switch (key.kind) {
      case 'digit': {
        if (mode === 'mai' && op === null && entry === '' && accum !== null) {
          setAccum(null);
        }
        if (entry === '0') {
          setEntry(key.value);
        } else if (entry.replace('.', '').length < 6) {
          setEntry(`${entry}${key.value}`);
        }
        return;
      }
      case 'dot': {
        if (mode !== 'mai' || entry.includes('.')) {
          return;
        }
        setEntry(`${entry === '' ? '0' : entry}.`);
        return;
      }
      case 'sign': {
        if (mode === 'fan') {
          setNegative((value) => !value);
        }
        return;
      }
      case 'plus':
      case 'minus': {
        if (mode !== 'mai') {
          return;
        }
        const nextOp = key.kind === 'plus' ? '+' : '-';
        if (entry !== '' && entry !== '.') {
          const value = Number.parseFloat(entry);
          if (accum === null) {
            setAccum(value);
          } else {
            setAccum(round1(op === '+' ? accum + value : accum - value));
          }
          setEntry('');
        } else if (accum === null) {
          setAccum(0);
        }
        setOp(nextOp);
        return;
      }
      case 'back': {
        if (entry !== '') {
          setEntry(entry.slice(0, -1));
          return;
        }
        if (mode === 'mai') {
          if (op !== null) {
            setOp(null);
            return;
          }
          if (accum !== null) {
            const trimmed = String(accum).slice(0, -1);
            setAccum(trimmed === '' || trimmed === '-' ? null : Number.parseFloat(trimmed));
            return;
          }
        }
        if (negative) {
          setNegative(false);
        }
        return;
      }
      case 'confirm': {
        if (mode === 'fan') {
          if (entry === '' || entry === '.') {
            onConfirm(null);
            return;
          }
          const parsed = Number.parseInt(entry, 10);
          onConfirm(negative ? -parsed : parsed);
          return;
        }
        onConfirm(round1(computeResult()));
        return;
      }
      case 'blank':
        return;
      default:
        return;
    }
  };

  const topRow: readonly KeyDef[] =
    mode === 'fan'
      ? [{ kind: 'sign' }, { kind: 'blank' }, { kind: 'confirm' }]
      : [{ kind: 'plus' }, { kind: 'minus' }, { kind: 'confirm' }];
  const bottomRow: readonly KeyDef[] =
    mode === 'fan'
      ? [{ kind: 'blank' }, { kind: 'digit', value: '0' }, { kind: 'back' }]
      : [{ kind: 'dot' }, { kind: 'digit', value: '0' }, { kind: 'back' }];

  const renderKey = (key: KeyDef, keyId: string) => {
    if (key.kind === 'blank') {
      return <span key={`${keyId}-blank`} className="numpad__blank" aria-hidden="true" />;
    }
    const className =
      key.kind === 'confirm'
        ? 'numpad__key numpad__key--confirm'
        : key.kind === 'back'
          ? 'numpad__key numpad__key--back'
          : key.kind === 'plus'
            ? 'numpad__key numpad__key--plus'
            : key.kind === 'minus'
              ? 'numpad__key numpad__key--minus'
              : key.kind === 'sign' || key.kind === 'dot'
                ? 'numpad__key numpad__key--fn'
                : 'numpad__key';
    return (
      <button
        key={`${keyId}-${key.kind}`}
        type="button"
        className={className}
        aria-label={keyAria(key)}
        onClick={() => press(key)}
      >
        {key.kind === 'back' ? (
          <BackspaceIcon size={20} />
        ) : key.kind === 'confirm' ? (
          <span className="numpad__confirm-label">
            <CheckIcon size={16} />
            完成
          </span>
        ) : key.kind === 'plus' ? (
          <PlusIcon size={20} />
        ) : key.kind === 'minus' ? (
          <MinusIcon size={20} />
        ) : (
          keyLabel(key)
        )}
      </button>
    );
  };

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <div
        className={`numpad__display ${mode === 'mai' && preview < 0 ? 'is-negative' : ''}`}
        aria-live="polite"
      >
        {display()}
      </div>
      <div className="numpad__grid">
        {topRow.map((key) => renderKey(key, `top-${key.kind}`))}
        {DIGIT_ROWS.map((row) =>
          row.map((key) => renderKey(key, `digit-${key.kind === 'digit' ? key.value : key.kind}`)),
        )}
        {bottomRow.map((key) => renderKey(key, `bottom-${key.kind}`))}
      </div>
    </Sheet>
  );
}
