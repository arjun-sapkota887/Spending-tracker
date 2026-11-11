import Papa from "papaparse";
import { categorize, type Category } from "./categories";

export type Transaction = {
  id: string;
  /** A local calendar day like "2026-10-03". Plain strings save to JSON as-is, with no timezone shifts. */
  date: string;
  description: string;
  merchant: string;
  /** Money out is negative and money in is positive, the same convention a bank account uses. */
  amount: number;
  account: string;
  category: Category;
  /** The import this came from. Entries added by hand don't have one. */
  importId?: string;
};

export type ParseResult = {
  transactions: Transaction[];
  skipped: number;
  /** True when the file showed purchases as positive numbers (common on credit cards) and we flipped them. */
  flipped: boolean;
};

// ---------- value parsers ----------

export function parseAmount(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) negative = true; // (12.34)
  if (/-\s*$/.test(s)) negative = true; // 12.34-
  if (/\bDR\b/i.test(s)) negative = true;
  s = s.replace(/\b(CR|DR|CAD|USD)\b/gi, "").replace(/[$€£,\s()]/g, "").replace(/-$/, "");
  if (!/^[-+]?\d*\.?\d+$/.test(s)) return null;
  const n = parseFloat(s);
  return negative ? -Math.abs(n) : n;
}

export const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};

type DateOrder = "MDY" | "DMY";

function fullYear(y: number) {
  return y < 100 ? 2000 + y : y;
}

export function parseDate(raw: string | undefined, order: DateOrder = "MDY"): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  let m: RegExpMatchArray | null;

  // 2026-11-03 or 2026/11/03 (optionally followed by a time)
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) {
    return makeDate(+m[1], +m[2] - 1, +m[3]);
  }
  // 11/03/2026, 03-11-26
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/))) {
    const [a, b, y] = [+m[1], +m[2], fullYear(+m[3])];
    return order === "DMY" ? makeDate(y, b - 1, a) : makeDate(y, a - 1, b);
  }
  // Nov 3, 2026 / November 03 2026
  if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/))) {
    const mon = MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon !== undefined) return makeDate(fullYear(+m[3]), mon, +m[2]);
  }
  // 3 Nov 2026 / 03-Nov-2026
  if ((m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3,9})\.?[\s-](\d{2,4})$/))) {
    const mon = MONTHS[m[2].slice(0, 4).toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon !== undefined) return makeDate(fullYear(+m[3]), mon, +m[1]);
  }
  return null;
}

function makeDate(y: number, mo: number, d: number): Date | null {
  const date = new Date(y, mo, d);
  if (date.getMonth() !== mo || y < 1990 || y > 2100) return null;
  return date;
}

/** Works out whether 03/04/2026 means March 4 or April 3, using the rest of the file. */
function detectDateOrder(values: string[]): DateOrder {
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.]\d{2,4}$/);
    if (m && +m[1] > 12) return "DMY";
    if (m && +m[2] > 12) return "MDY";
  }
  return "MDY";
}

// ---------- merchant cleanup ----------

const NOISE_PREFIXES =
  /^(pos |point of sale |visa debit |interac |purchase |debit card purchase |recurring |preauthorized |pre-authorized |sq \*|tst\* ?|sp \*|paypal \*|pp\*|-\s*)+/i;

export function cleanMerchant(description: string): string {
  let s = description.replace(NOISE_PREFIXES, "");
  s = s
    // Filler words, so "E-TRANSFER SENT PRIYA" becomes "Priya" and "PAYROLL DEPOSIT DYNE" becomes "Dyne".
    .replace(/\be-?transfer\b|\b(sent|received|from|to|payroll|deposit|mobile)\b/gi, " ")
    .replace(/\s+\S+\.(com|ca|net|org)\S*/gi, " ") // trailing web addresses like "help.uber.com"
    .replace(/[#*]\s*\w*\d\w*/g, " ") // store numbers like #1234 or *AB12C
    .replace(/\b\w*\d\w*\b/g, " ") // any leftover token that contains digits
    .replace(/[^A-Za-z&'.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = s.split(" ").slice(0, 4).join(" ");
  if (!words) return description.trim();
  return words
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ---------- column detection ----------

type Columns = {
  date: number;
  description: number;
  amount?: number;
  debit?: number;
  credit?: number;
  type?: number;
};

function findHeaderColumns(header: string[]): Columns | null {
  const h = header.map((c) => c.trim().toLowerCase());
  const find = (re: RegExp, exclude: number[] = []) =>
    h.findIndex((c, i) => re.test(c) && !exclude.includes(i));

  let date = find(/transaction date|trans\.? date/);
  if (date < 0) date = find(/date/);
  if (date < 0) return null;

  const amount = find(/amount/, [date]);
  const debit = find(/^debits?$|^debit amount|withdraw|money out|paid out|^charges?$/, [date, amount]);
  const credit = find(/^credits?$|^credit amount|deposit|money in|paid in/, [date, amount, debit]);
  const type = find(/type|dr\/cr|cr\/dr|debit\/credit|credit\/debit/, [date, amount, debit, credit]);

  const used = [date, amount, debit, credit, type];
  let description = find(/description|merchant|payee|details|narrative|^name$|transaction$|memo/, used);
  if (description < 0) description = find(/memo|reference|^name/, used);
  if (description < 0) return null;

  const cols: Columns = { date, description };
  if (debit >= 0 && credit >= 0) {
    cols.debit = debit;
    cols.credit = credit;
  } else if (amount >= 0) {
    cols.amount = amount;
    if (type >= 0) cols.type = type;
  } else if (debit >= 0) {
    cols.amount = debit;
  } else {
    return null;
  }
  return cols;
}

/** For files with no header row, like the TD and CIBC exports: work out each column from what its values look like. */
function inferColumns(rows: string[][]): Columns | null {
  const sample = rows.slice(0, 50);
  const width = Math.max(...sample.map((r) => r.length));
  const kinds: ("date" | "number" | "text" | "empty")[] = [];
  const avgLen: number[] = [];
  const filled: boolean[][] = [];

  for (let c = 0; c < width; c++) {
    const vals = sample.map((r) => (r[c] ?? "").trim());
    const nonEmpty = vals.filter(Boolean);
    filled.push(vals.map(Boolean));
    avgLen.push(nonEmpty.reduce((s, v) => s + v.length, 0) / (nonEmpty.length || 1));
    if (!nonEmpty.length) kinds.push("empty");
    else if (nonEmpty.every((v) => parseDate(v, "MDY") || parseDate(v, "DMY"))) kinds.push("date");
    else if (nonEmpty.every((v) => parseAmount(v) !== null)) kinds.push("number");
    else kinds.push("text");
  }

  const date = kinds.indexOf("date");
  const texts = kinds.map((k, i) => (k === "text" ? i : -1)).filter((i) => i >= 0);
  const numbers = kinds.map((k, i) => (k === "number" ? i : -1)).filter((i) => i >= 0);
  if (date < 0 || !texts.length || !numbers.length) return null;

  const description = texts.reduce((best, i) => (avgLen[i] > avgLen[best] ? i : best), texts[0]);
  if (numbers.length === 1) return { date, description, amount: numbers[0] };

  // Two numeric columns that are never both filled on the same row are a withdrawal and
  // deposit pair. If both are always filled, the pair is amount and balance instead.
  const [a, b] = numbers;
  const exclusive = sample.every((_, r) => !(filled[a][r] && filled[b][r]));
  return exclusive ? { date, description, debit: a, credit: b } : { date, description, amount: a };
}

// ---------- main entry ----------

export function parseStatement(csvText: string, account: string, importId: string): ParseResult {
  const { data } = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true });
  const rows = data.filter((r) => r.some((c) => c && c.trim()));

  // Many banks put a few lines of account info above the header, so look for it in the first 15 rows.
  let cols: Columns | null = null;
  let start = 0;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const c = findHeaderColumns(rows[i]);
    if (c) {
      cols = c;
      start = i + 1;
      break;
    }
  }
  if (!cols) {
    start = rows.findIndex((r) => r.some((c) => parseDate(c)));
    if (start < 0) throw new Error("Couldn't find any dates in this file. Is it a CSV statement export?");
    cols = inferColumns(rows.slice(start));
    if (!cols) throw new Error("Couldn't work out which columns hold the date, description and amount.");
  }

  const body = rows.slice(start);
  const order = detectDateOrder(body.map((r) => r[cols!.date] ?? ""));

  const raw: RawRow[] = [];
  let skipped = 0;
  let explicitSign = false;

  for (const r of body) {
    const date = parseDate(r[cols.date], order);
    const description = (r[cols.description] ?? "").trim();
    let amount: number | null = null;

    if (cols.debit !== undefined && cols.credit !== undefined) {
      const out = parseAmount(r[cols.debit]);
      const inn = parseAmount(r[cols.credit]);
      if (out !== null || inn !== null) amount = Math.abs(inn ?? 0) - Math.abs(out ?? 0);
      explicitSign = true;
    } else if (cols.amount !== undefined) {
      amount = parseAmount(r[cols.amount]);
      const type = cols.type !== undefined ? (r[cols.type] ?? "").toLowerCase() : "";
      if (amount !== null && type) {
        if (/debit|\bdr\b|withdraw|purchase|sale/.test(type)) {
          amount = -Math.abs(amount);
          explicitSign = true;
        } else if (/credit|\bcr\b|deposit|payment|refund|return/.test(type)) {
          amount = Math.abs(amount);
          explicitSign = true;
        }
      }
    }

    if (!date || amount === null || amount === 0 || !description) {
      skipped++;
      continue;
    }
    raw.push({ date, description, amount });
  }

  return finishParse(raw, explicitSign, skipped, account, importId);
}

export type RawRow = { date: Date; description: string; amount: number };

/**
 * The last step for every statement format. When the file didn't make it clear which
 * direction the money went, guess the sign convention. Most statements have more purchases
 * than payments, so if positive numbers are the majority, purchases are probably shown as
 * positive and the signs need flipping.
 */
export function finishParse(
  raw: RawRow[],
  explicitSign: boolean,
  skipped: number,
  account: string,
  importId: string,
): ParseResult {
  let flipped = false;
  if (!explicitSign) {
    const positives = raw.filter((t) => t.amount > 0).length;
    flipped = positives > raw.length / 2;
  }

  const transactions = raw.map((t) => {
    const amount = flipped ? -t.amount : t.amount;
    return newTransaction({ date: toDayString(t.date), description: t.description, amount, account, importId });
  });
  return { transactions, skipped, flipped };
}

export function newTransaction(t: {
  date: string;
  description: string;
  amount: number;
  account: string;
  category?: Category;
  importId?: string;
}): Transaction {
  return {
    ...t,
    id: crypto.randomUUID(),
    merchant: cleanMerchant(t.description),
    category: t.category ?? categorize(t.description, t.amount),
  };
}

export function toDayString(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
