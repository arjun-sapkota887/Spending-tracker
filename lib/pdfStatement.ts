import { MONTHS, finishParse, parseAmount, type ParseResult, type RawRow } from "./parse";

/** A run of text on one line. Pieces with only a small gap between them are joined into one cell. */
export type PdfCell = { x: number; right: number; str: string };
export type PdfLine = { page: number; cells: PdfCell[]; text: string };

type PdfJs = typeof import("pdfjs-dist");

// ---------- turning a PDF into lines of text ----------

/**
 * A PDF has no rows or columns, just bits of text placed at x/y positions. This puts them
 * back into lines (same y) and cells (pieces of text that sit close together).
 */
export async function extractLines(data: ArrayBuffer, pdfjs: PdfJs): Promise<PdfLine[]> {
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  } catch (e) {
    if ((e as Error)?.name === "PasswordException") {
      throw new Error("this PDF is password-protected. Download it again without a password, or use the CSV.");
    }
    throw new Error("couldn't open this PDF.");
  }

  const lines: PdfLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items
      .filter((i) => "str" in i && i.str.trim())
      .map((i) => {
        const item = i as { str: string; transform: number[]; width: number };
        return { str: item.str, x: item.transform[4], y: item.transform[5], width: item.width };
      })
      // Top of the page first (PDF y grows upward), then left to right.
      .sort((a, b) => b.y - a.y || a.x - b.x);

    let row: typeof items = [];
    const flush = () => {
      if (!row.length) return;
      row.sort((a, b) => a.x - b.x);
      const cells: PdfCell[] = [];
      for (const it of row) {
        const last = cells[cells.length - 1];
        const gap = last ? it.x - last.right : Infinity;
        // Pieces within about one character's width of each other are part of the same cell.
        if (last && gap < 4) {
          last.str += (gap > 1 ? " " : "") + it.str;
          last.right = it.x + it.width;
        } else {
          cells.push({ x: it.x, right: it.x + it.width, str: it.str });
        }
      }
      for (const c of cells) c.str = c.str.replace(/\s+/g, " ").trim();
      lines.push({ page: p, cells, text: cells.map((c) => c.str).join("  ") });
      row = [];
    };
    for (const it of items) {
      if (row.length && Math.abs(row[0].y - it.y) > 3) flush();
      row.push(it);
    }
    flush();
  }
  return lines;
}

// ---------- reading transactions out of the lines ----------

const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const MONEY = /^\(?[-+]?\$?\s?\d{1,3}(?:,?\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR|-))?$/i;
const TRAILING_MONEY = /\s(\(?[-+]?\$?\s?\d{1,3}(?:,?\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR|-))?)$/i;

// Summary and heading rows that have amounts in them but aren't transactions.
const NOT_A_TRANSACTION =
  /balance forward|opening balance|closing balance|previous (statement )?balance|new balance|^balance\b|\btotal\b|subtotal|minimum payment|credit limit|available credit|payment due|interest rate|annual interest|statement period|account (number|summary)|^page \d/i;

const OUT_HEADER = /withdraw|debit|cheques|paid out|money out|charges/i;
const IN_HEADER = /deposit|credit|paid in|money in/i;
const BALANCE_HEADER = /balance/i;

type DayMonth = { month: number; day: number; year?: number; length: number };

/** Reads a date at the start of a line, like "Oct 03", "03 OCT", "10/03" or "2026-10-03". */
function leadingDate(text: string, dmy: boolean): DayMonth | null {
  let m: RegExpMatchArray | null;
  if ((m = text.match(new RegExp(`^${MON}\\s+(\\d{1,2})(?:,?\\s+(\\d{4}))?\\b`, "i")))) {
    return { month: monthIndex(m[1]), day: +m[2], year: m[3] ? +m[3] : undefined, length: m[0].length };
  }
  if ((m = text.match(new RegExp(`^(\\d{1,2})[\\s-]+${MON}(?:[\\s-]+(\\d{4}))?\\b`, "i")))) {
    return { month: monthIndex(m[2]), day: +m[1], year: m[3] ? +m[3] : undefined, length: m[0].length };
  }
  if ((m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    return { month: +m[2] - 1, day: +m[3], year: +m[1], length: m[0].length };
  }
  if ((m = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const [a, b] = [+m[1], +m[2]];
    const year = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : undefined;
    return dmy
      ? { month: b - 1, day: a, year, length: m[0].length }
      : { month: a - 1, day: b, year, length: m[0].length };
  }
  return null;
}

const monthIndex = (name: string) => MONTHS[name.slice(0, 4).toLowerCase()] ?? MONTHS[name.slice(0, 3).toLowerCase()];

/**
 * Card statements often leave the year off each transaction ("Oct 03"). The statement's
 * own dates (period, closing date) give us the latest date it covers, and that tells us
 * which year each transaction belongs to, even on a statement that runs from December
 * into January.
 */
function statementEndDate(allText: string): Date {
  const found: Date[] = [];
  for (const m of allText.matchAll(new RegExp(`${MON}\\s+(\\d{1,2}),?\\s+(20\\d{2})`, "gi"))) {
    found.push(new Date(+m[3], monthIndex(m[1]), +m[2]));
  }
  for (const m of allText.matchAll(new RegExp(`(\\d{1,2})\\s+${MON},?\\s+(20\\d{2})`, "gi"))) {
    found.push(new Date(+m[3], monthIndex(m[2]), +m[1]));
  }
  for (const m of allText.matchAll(/(20\d{2})-(\d{2})-(\d{2})/g)) found.push(new Date(+m[1], +m[2] - 1, +m[3]));
  for (const m of allText.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)) found.push(new Date(+m[3], +m[1] - 1, +m[2]));
  const valid = found.filter((d) => !isNaN(d.getTime()) && d <= new Date(Date.now() + 86_400_000 * 60));
  return valid.length ? new Date(Math.max(...valid.map((d) => d.getTime()))) : new Date();
}

function resolveDate(d: DayMonth, end: Date): Date | null {
  if (d.month === undefined || d.month < 0 || d.month > 11 || d.day < 1 || d.day > 31) return null;
  if (d.year) return new Date(d.year, d.month, d.day);
  const date = new Date(end.getFullYear(), d.month, d.day);
  // A date more than a couple of weeks after the statement ends must belong to the previous year.
  if (date.getTime() > end.getTime() + 15 * 86_400_000) date.setFullYear(date.getFullYear() - 1);
  return date;
}

/** Splits an amount off the end of a cell, so "PAYMENT THANK YOU 500.00" also works when the PDF packed it into one cell. */
function splitCells(cells: PdfCell[]): PdfCell[] {
  const out: PdfCell[] = [];
  for (const c of cells) {
    const m = !MONEY.test(c.str) && c.str.match(TRAILING_MONEY);
    if (m) {
      out.push({ ...c, str: c.str.slice(0, m.index).trim() });
      out.push({ x: c.right - 1, right: c.right, str: m[1].trim() });
    } else {
      out.push(c);
    }
  }
  return out;
}

type Column = { kind: "out" | "in" | "balance"; center: number };

export function parsePdfStatement(lines: PdfLine[], account: string, importId: string): ParseResult {
  if (!lines.length) {
    throw new Error("this PDF has no readable text. It's probably a scan, so download the CSV from your bank instead.");
  }

  const allText = lines.map((l) => l.text).join("\n");
  const end = statementEndDate(allText);
  // If any slash date has a first number over 12 (like 25/10), the statement writes the day first.
  const dmy = lines.some((l) => {
    const m = l.text.match(/^(\d{1,2})\/(\d{1,2})/);
    return m && +m[1] > 12;
  });

  const raw: RawRow[] = [];
  let skipped = 0;
  let columns: Column[] | null = null;
  let lastDate: Date | null = null;

  for (const line of lines) {
    const cells = splitCells(line.cells);

    // A row of column headings, like "Date  Description  Withdrawals  Deposits  Balance".
    if (OUT_HEADER.test(line.text) && IN_HEADER.test(line.text) && !MONEY.test(cells[cells.length - 1]?.str ?? "")) {
      const found: Column[] = [];
      for (const c of cells) {
        const center = (c.x + c.right) / 2;
        if (BALANCE_HEADER.test(c.str)) found.push({ kind: "balance", center });
        else if (OUT_HEADER.test(c.str)) found.push({ kind: "out", center });
        else if (IN_HEADER.test(c.str)) found.push({ kind: "in", center });
      }
      if (found.some((c) => c.kind === "out") && found.some((c) => c.kind === "in")) columns = found;
      continue;
    }

    const amountCells = cells.filter((c) => MONEY.test(c.str));
    if (!amountCells.length) continue;

    // Whatever isn't an amount is the date plus the description.
    let description = cells
      .filter((c) => !MONEY.test(c.str))
      .map((c) => c.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const date = leadingDate(description, dmy);
    // A row with no date of its own only counts on statements with withdrawal/deposit columns,
    // where it's normal to print the date once per day.
    if (!date && !(columns && lastDate)) continue;
    if (date) {
      description = description.slice(date.length).trim();
      // Card statements often have a second "posted" date right after the transaction date.
      const posted = leadingDate(description, dmy);
      if (posted) description = description.slice(posted.length).trim();
    }

    const resolved: Date | null = date ? resolveDate(date, end) : lastDate;
    if (!resolved || !description || NOT_A_TRANSACTION.test(description)) {
      if (date) skipped++;
      continue;
    }
    lastDate = resolved;

    let amount: number | null = null;
    if (columns) {
      // Each amount belongs to whichever column heading it sits closest to.
      for (const c of amountCells) {
        const center = (c.x + c.right) / 2;
        const col = columns.reduce((best, k) => (Math.abs(k.center - center) < Math.abs(best.center - center) ? k : best));
        const value = parseAmount(c.str);
        if (value === null || col.kind === "balance") continue;
        amount = col.kind === "out" ? -Math.abs(value) : Math.abs(value);
        break;
      }
    } else {
      amount = parseAmount(amountCells[0].str);
    }
    if (amount === null || amount === 0) {
      skipped++;
      continue;
    }
    raw.push({ date: resolved, description, amount });
  }

  if (!raw.length) {
    throw new Error("couldn't find any transactions in this PDF. Try downloading the CSV from your bank instead.");
  }
  // With withdrawal and deposit columns the direction is known. Otherwise, guess it the same way as for CSVs.
  return finishParse(raw, columns !== null, skipped, account, importId);
}

/** Reads a PDF statement in the browser. pdf.js is only downloaded the first time a PDF is imported. */
export async function readPdfStatement(file: Blob, account: string, importId: string): Promise<ParseResult> {
  const pdfjs = await import("pdfjs-dist");
  // The worker script is copied into /public by the "postinstall" script in package.json.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return parsePdfStatement(await extractLines(await file.arrayBuffer(), pdfjs), account, importId);
}
