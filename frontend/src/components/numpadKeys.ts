export type KeyDef =
  | { readonly kind: 'digit'; readonly value: string }
  | { readonly kind: 'dot' }
  | { readonly kind: 'sign' }
  | { readonly kind: 'plus' }
  | { readonly kind: 'minus' }
  | { readonly kind: 'back' }
  | { readonly kind: 'confirm' }
  | { readonly kind: 'blank' };

export const DIGIT_ROWS: readonly (readonly KeyDef[])[] = [
  [
    { kind: 'digit', value: '1' },
    { kind: 'digit', value: '2' },
    { kind: 'digit', value: '3' },
  ],
  [
    { kind: 'digit', value: '4' },
    { kind: 'digit', value: '5' },
    { kind: 'digit', value: '6' },
  ],
  [
    { kind: 'digit', value: '7' },
    { kind: 'digit', value: '8' },
    { kind: 'digit', value: '9' },
  ],
];

export function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function keyLabel(key: KeyDef): string {
  switch (key.kind) {
    case 'digit':
      return key.value;
    case 'dot':
      return '.';
    case 'sign':
      return '±';
    case 'plus':
      return '+';
    case 'minus':
      return '−';
    case 'back':
      return '刪除';
    case 'confirm':
      return '完成';
    case 'blank':
      return '';
    default:
      return '';
  }
}

export function keyAria(key: KeyDef): string {
  switch (key.kind) {
    case 'digit':
      return key.value;
    case 'dot':
      return '小數點';
    case 'sign':
      return '切換正負';
    case 'plus':
      return '加';
    case 'minus':
      return '減';
    case 'back':
      return '刪除';
    case 'confirm':
      return '完成';
    case 'blank':
      return '';
    default:
      return '';
  }
}
