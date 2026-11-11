"use client";

import { Card, CardBody, CardHeader, Tooltip } from "@heroui/react";
import { ArrowDownRight, ArrowUpRight, HandCoins, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";
import { NEUTRAL, SERIES, colorOf } from "@/lib/categories";
import { money, monthShort, percent, shortDate } from "@/lib/format";
import type { MonthSummary } from "@/lib/summary";
import { DailyChart } from "./charts";

type Props = {
  summary: MonthSummary;
  previous: MonthSummary | null;
  loans: { owedToYou: number; youOwe: number };
};

export function Overview({ summary, previous, loans }: Props) {
  const prevLabel = previous ? monthShort(previous.month) : "";
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<TrendingDown size={18} />}
          label="Spent"
          value={money(summary.spent)}
          footer={previous && <Delta now={summary.spent} before={previous.spent} label={prevLabel} upIsGood={false} />}
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Income"
          value={money(summary.income)}
          footer={previous && <Delta now={summary.income} before={previous.income} label={prevLabel} upIsGood />}
        />
        <StatCard
          icon={<PiggyBank size={18} />}
          label={summary.net >= 0 ? "Saved" : "Overspent"}
          value={money(Math.abs(summary.net))}
          footer={
            <span className="text-default-500">
              {summary.savingsRate !== null
                ? `${percent(Math.max(summary.savingsRate, 0))} of income kept`
                : "No income this month"}
            </span>
          }
          highlight
        />
        <StatCard
          icon={<HandCoins size={18} />}
          label="Owed to you"
          value={money(loans.owedToYou)}
          footer={
            <span className="text-default-500">
              You owe <b className="text-foreground">{money(loans.youOwe)}</b> · all time
            </span>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Spending by category" className="lg:col-span-3" right={`${money(summary.spent)} total`}>
          <CategoryBreakdown summary={summary} previous={previous} />
        </Panel>
        <div className="grid content-start gap-4 lg:col-span-2">
          <Panel title="Income sources" right={money(summary.income)}>
            <IncomeSources summary={summary} />
          </Panel>
          {(summary.lent !== 0 || summary.borrowed !== 0) && (
            <Panel title="Lent & borrowed this month">
              <div className="grid grid-cols-2 gap-3 text-small">
                <MiniStat label={summary.lent >= 0 ? "Lent out" : "Paid back to you"} value={Math.abs(summary.lent)} />
                <MiniStat label={summary.borrowed >= 0 ? "Borrowed" : "You paid back"} value={Math.abs(summary.borrowed)} />
              </div>
            </Panel>
          )}
          <Panel title="Top merchants">
            <ul className="grid gap-2.5 text-small">
              {summary.topMerchants.map((m) => (
                <li key={m.merchant} className="flex justify-between gap-2">
                  <span className="truncate">
                    {m.merchant} <span className="text-default-400">×{m.count}</span>
                  </span>
                  <span className="tabular-nums font-medium">{money(m.amount)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Daily spending" className="lg:col-span-3" right={`${money(summary.perDay)} / day`}>
          <DailyChart data={summary.daily} />
        </Panel>
        <Panel title="Biggest purchases" className="lg:col-span-2">
          <ul className="grid gap-3 text-small">
            {summary.largest.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-3">
                  <span className="w-12 shrink-0 text-tiny text-default-400">{shortDate(t.date)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.merchant}</span>
                    <span className="block text-tiny text-default-400">{t.category}</span>
                  </span>
                </span>
                <span className="tabular-nums font-medium">{money(-t.amount)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export function Panel({
  title,
  right,
  className = "",
  children,
}: {
  title: string;
  right?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card shadow="none" className={`border border-default-200 ${className}`}>
      <CardHeader className="flex justify-between px-5 pt-4">
        <h3 className="font-semibold">{title}</h3>
        {right && <span className="text-small text-default-500 tabular-nums">{right}</span>}
      </CardHeader>
      <CardBody className="px-5 pb-5 pt-1">{children}</CardBody>
    </Card>
  );
}

function StatCard({
  icon,
  label,
  value,
  footer,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  footer?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card
      shadow="none"
      className={highlight ? "bg-gradient-to-br from-primary-500 to-primary-700 text-white" : "border border-default-200"}
    >
      <CardBody className="gap-2 p-5">
        <div className={`flex items-center gap-2 text-small ${highlight ? "text-white/80" : "text-default-500"}`}>
          <span className={`rounded-lg p-1.5 ${highlight ? "bg-white/20" : "bg-default-100"}`}>{icon}</span>
          {label}
        </div>
        <div className="text-3xl font-semibold tracking-tight">{value}</div>
        <div className={`text-tiny ${highlight ? "[&_*]:!text-white/80 text-white/80" : ""}`}>{footer}</div>
      </CardBody>
    </Card>
  );
}

function Delta({ now, before, label, upIsGood }: { now: number; before: number; label: string; upIsGood: boolean }) {
  const diff = now - before;
  if (Math.abs(diff) < 0.5) return <span className="text-default-500">Same as {label}</span>;
  const up = diff > 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${good ? "text-success-600" : "text-danger"}`}>
      <Icon size={14} />
      {money(Math.abs(diff))} {up ? "more" : "less"} than {label}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-default-100 p-3">
      <div className="text-tiny text-default-500">{label}</div>
      <div className="font-semibold tabular-nums">{money(value)}</div>
    </div>
  );
}

function CategoryBreakdown({ summary, previous }: Omit<Props, "loans">) {
  if (!summary.byCategory.length) return <p className="text-small text-default-500">No spending this month.</p>;

  // The stacked bar gives one segment to each coloured category and lumps the grey ones into
  // a single segment, so two grey segments never sit side by side looking like one category.
  const colored = summary.byCategory.filter((c) => colorOf(c.category) !== NEUTRAL);
  const rest = summary.spent - colored.reduce((s, c) => s + c.amount, 0);
  const segments = [
    ...colored.map((c) => ({ label: c.category, amount: c.amount, color: colorOf(c.category) })),
    ...(rest > 0.005 ? [{ label: "Everything else", amount: rest, color: NEUTRAL }] : []),
  ];
  const max = summary.byCategory[0].amount;
  const prevBy = new Map(previous?.byCategory.map((c) => [c.category, c.amount]));

  return (
    <div className="grid gap-5">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((s) => (
          <Tooltip key={s.label} content={`${s.label}: ${money(s.amount)} (${percent(s.amount / summary.spent)})`}>
            <div className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(s.amount / summary.spent) * 100}%`, background: s.color }} />
          </Tooltip>
        ))}
      </div>
      <ul className="grid gap-3.5">
        {summary.byCategory.map((c) => {
          const before = prevBy.get(c.category) ?? 0;
          const diff = c.amount - before;
          return (
            <li key={c.category} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-2 text-small">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(c.category) }} />
                  <span className="font-medium">{c.category}</span>
                  <span className="text-tiny text-default-400">{c.count}</span>
                </span>
                <span className="flex items-baseline gap-3 tabular-nums">
                  {previous && Math.abs(diff) >= 1 && (
                    <span className={`text-tiny ${diff > 0 ? "text-danger" : "text-success-600"}`}>
                      {diff > 0 ? "▲" : "▼"} {money(Math.abs(diff))}
                    </span>
                  )}
                  <span className="font-semibold">{money(c.amount)}</span>
                  <span className="w-9 text-right text-tiny text-default-400">{percent(c.amount / summary.spent)}</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-default-100">
                <div className="h-full rounded-full" style={{ width: `${(c.amount / max) * 100}%`, background: colorOf(c.category) }} />
              </div>
            </li>
          );
        })}
      </ul>
      {previous && <p className="text-tiny text-default-400">▲▼ change compared with {monthShort(previous.month)}</p>}
    </div>
  );
}

function IncomeSources({ summary }: { summary: MonthSummary }) {
  if (!summary.bySource.length) return <p className="text-small text-default-500">No income recorded this month.</p>;
  const max = summary.bySource[0].amount;
  return (
    <ul className="grid gap-3">
      {summary.bySource.map((s) => (
        <li key={s.category} className="grid gap-1.5">
          <div className="flex justify-between text-small">
            <span className="font-medium">{s.category}</span>
            <span className="tabular-nums">
              <b>{money(s.amount)}</b>{" "}
              <span className="text-tiny text-default-400">{percent(s.amount / summary.income)}</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-default-100">
            <div className="h-full rounded-full" style={{ width: `${(s.amount / max) * 100}%`, background: SERIES.income }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
