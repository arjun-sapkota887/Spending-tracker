import { INCOME, SPENDING, kindOf, type Category } from "./categories";
import type { Transaction } from "./parse";

type Total = { category: Category; amount: number; count: number };

export type MonthSummary = {
  month: string;
  spent: number;
  income: number;
  net: number;
  /** Share of income left over after spending, or null when there was no income. */
  savingsRate: number | null;
  count: number;
  perDay: number;
  byCategory: Total[];
  bySource: Total[];
  lent: number;
  borrowed: number;
  topMerchants: { merchant: string; amount: number; count: number }[];
  largest: Transaction[];
  daily: { day: number; date: string; amount: number }[];
};

export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Every month that has transactions, newest first. */
export function monthsOf(txns: Transaction[]) {
  return [...new Set(txns.map((t) => monthOf(t.date)))].sort().reverse();
}

function totals(txns: Transaction[], categories: readonly Category[], sign: 1 | -1): Total[] {
  return categories
    .map((category) => {
      const inCat = txns.filter((t) => t.category === category);
      // Spending is money out, so its amounts are negated. A refund then cancels out part of the purchase.
      return { category, amount: sign * inCat.reduce((s, t) => s + t.amount, 0), count: inCat.length };
    })
    .filter((c) => c.amount > 0.005)
    .sort((a, b) => b.amount - a.amount);
}

export function summarizeMonth(all: Transaction[], month: string): MonthSummary {
  const txns = all.filter((t) => monthOf(t.date) === month);
  const spending = txns.filter((t) => kindOf(t.category) === "spending");

  const byCategory = totals(txns, SPENDING, -1);
  const bySource = totals(txns, INCOME, 1);
  const spent = byCategory.reduce((s, c) => s + c.amount, 0);
  const income = bySource.reduce((s, c) => s + c.amount, 0);

  const merchants = new Map<string, { amount: number; count: number }>();
  for (const t of spending.filter((t) => t.amount < 0)) {
    const m = merchants.get(t.merchant) ?? { amount: 0, count: 0 };
    m.amount -= t.amount;
    m.count++;
    merchants.set(t.merchant, m);
  }

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const daily = Array.from({ length: daysInMonth }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    const amount = spending.filter((t) => t.date === date && t.amount < 0).reduce((s, t) => s - t.amount, 0);
    return { day: i + 1, date, amount };
  });

  // For the month we're in now, average over the days so far rather than the whole month.
  const now = new Date();
  const isCurrent = now.getFullYear() === y && now.getMonth() + 1 === m;
  const daysCounted = isCurrent ? now.getDate() : daysInMonth;

  return {
    month,
    spent,
    income,
    net: income - spent,
    savingsRate: income > 0 ? (income - spent) / income : null,
    count: txns.length,
    perDay: spent / daysCounted,
    byCategory,
    bySource,
    lent: -sum(txns.filter((t) => t.category === "Lent")),
    borrowed: sum(txns.filter((t) => t.category === "Borrowed")),
    topMerchants: [...merchants]
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6),
    largest: spending
      .filter((t) => t.amount < 0)
      .sort((a, b) => a.amount - b.amount)
      .slice(0, 5),
    daily,
  };
}

/**
 * Running totals across every month. Money you lend goes out as a negative amount and comes
 * back as a positive one, so what's left is what people still owe you. Borrowing works the
 * same way in reverse.
 */
export function loanBalances(all: Transaction[]) {
  return {
    owedToYou: -sum(all.filter((t) => t.category === "Lent")),
    youOwe: sum(all.filter((t) => t.category === "Borrowed")),
  };
}

const sum = (txns: Transaction[]) => txns.reduce((s, t) => s + t.amount, 0);

/**
 * Removes rows that are already saved, so uploading the same statement twice adds nothing.
 * It compares counts, not just whether a row exists: if you really bought two identical
 * coffees on the same day, the second one is kept.
 */
export function withoutDuplicates(existing: Transaction[], incoming: Transaction[]) {
  const key = (t: Transaction) => `${t.date}|${t.amount.toFixed(2)}|${t.description.toLowerCase().replace(/\s+/g, " ")}`;
  const seen = new Map<string, number>();
  for (const t of existing) seen.set(key(t), (seen.get(key(t)) ?? 0) + 1);
  return incoming.filter((t) => {
    const k = key(t);
    const left = seen.get(k) ?? 0;
    if (left > 0) {
      seen.set(k, left - 1);
      return false;
    }
    return true;
  });
}
