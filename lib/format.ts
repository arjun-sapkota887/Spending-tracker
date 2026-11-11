const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const compact = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });

export const money = (n: number) => currency.format(n);
export const moneyShort = (n: number) => compact.format(n);

/** Splits "2026-10-03" into parts itself, because new Date("2026-10-03") reads it as UTC and can land on the wrong day. */
const toDate = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d ?? 1);
};

export const shortDate = (day: string) => toDate(day).toLocaleDateString("en-CA", { month: "short", day: "numeric" });

export const monthLabel = (month: string) =>
  toDate(month).toLocaleDateString("en-CA", { month: "long", year: "numeric" });

export const monthShort = (month: string) => toDate(month).toLocaleDateString("en-CA", { month: "short" });

export const percent = (n: number) => `${Math.round(n * 100)}%`;
