/**
 * Dependency-free RFC4180 CSV parser.
 *
 * Upstream market data has quoted fields containing commas and player names
 * like `Ja'Marr Chase`, plus BOM'd exports. A naive `split(',')` silently
 * corrupts rows in those cases instead of failing loudly, so this walks the
 * text character-by-character and tracks quote state explicitly.
 */

/** Parse raw CSV text into a grid of string cells (no header handling). */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let sawAnyFieldInRow = false;

  const endField = () => {
    row.push(field);
    field = '';
    sawAnyFieldInRow = true;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    sawAnyFieldInRow = false;
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];

    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      endField();
    } else if (c === '\r') {
      if (src[i + 1] === '\n') i++;
      endRow();
    } else if (c === '\n') {
      endRow();
    } else {
      field += c;
    }
  }

  // Only flush a trailing partial record — a clean trailing newline already
  // closed the last row via endRow(), and must not produce a spurious empty one.
  if (field !== '' || sawAnyFieldInRow) {
    endRow();
  }

  return rows;
}

/** Parse CSV text into records keyed by the header row (row 0). */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const [header, ...dataRows] = rows;
  return dataRows.map((cells, idx) => {
    if (cells.length !== header.length) {
      throw new Error(
        `parseCsvRecords: ragged row at line ${idx + 2} — expected ${header.length} fields, got ${cells.length}`,
      );
    }
    const record: Record<string, string> = {};
    for (let i = 0; i < header.length; i++) {
      record[header[i]] = cells[i];
    }
    return record;
  });
}

/**
 * Fail loudly, naming exactly which expected columns are missing.
 *
 * A silent upstream column rename is the most likely future breakage: without
 * this, a renamed column would just read as `undefined` everywhere downstream
 * and produce hundreds of rows of nulls instead of an obvious CI failure.
 */
export function assertHeader(header: string[], expected: string[]): void {
  const missing = expected.filter((col) => !header.includes(col));
  if (missing.length > 0) {
    throw new Error(`assertHeader: missing column(s): ${missing.join(', ')}`);
  }
}
