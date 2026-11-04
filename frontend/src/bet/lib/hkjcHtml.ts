const STATEMENT_CLASSES = ['ARResultTable', 'print-table'] as const;
const SKIP_MARKERS = ['交易編號', '之戶口結餘', '- 完 -'] as const;

function codePointFrom(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0x10ffff) {
    return '';
  }
  return String.fromCodePoint(value);
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => codePointFrom(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => codePointFrom(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function stripHtml(value: string): string {
  const withoutTags = value.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, ' ');
  return decodeEntities(withoutTags)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasStatementClass(openTag: string): boolean {
  const classMatch = /\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(openTag);
  const classValue = classMatch?.[1] ?? classMatch?.[2] ?? '';
  const classes = classValue.split(/\s+/);
  return STATEMENT_CLASSES.every((className) => classes.includes(className));
}

function findTableClose(html: string, contentStart: number): number {
  const tagPattern = /<table\b[^>]*>|<\/table\s*>/gi;
  tagPattern.lastIndex = contentStart;
  let depth = 1;
  for (;;) {
    const match = tagPattern.exec(html);
    if (match === null) {
      return -1;
    }
    const tag = match[0];
    if (tag === undefined) {
      return -1;
    }
    if (/^<\/table/i.test(tag)) {
      depth -= 1;
      if (depth === 0) {
        return match.index;
      }
    } else {
      depth += 1;
    }
  }
}

export function findStatementTable(html: string): string | null {
  for (const match of html.matchAll(/<table\b[^>]*>/gi)) {
    const openTag = match[0];
    if (openTag === undefined || !hasStatementClass(openTag)) {
      continue;
    }
    const contentStart = (match.index ?? 0) + openTag.length;
    const closeIndex = findTableClose(html, contentStart);
    if (closeIndex === -1) {
      return null;
    }
    return html.slice(contentStart, closeIndex);
  }
  return null;
}

export function extractRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const rowHtml = rowMatch[1] ?? '';
    const cells: string[] = [];
    for (const cellMatch of rowHtml.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)) {
      cells.push(stripHtml(cellMatch[1] ?? ''));
    }
    rows.push(cells);
  }
  return rows;
}

export function isSkippableRow(cells: readonly string[]): boolean {
  const text = cells.join(' ');
  return SKIP_MARKERS.some((marker) => text.includes(marker));
}
