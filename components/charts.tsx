"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SERIES } from "@/lib/categories";
import { money, moneyShort, monthShort, shortDate } from "@/lib/format";

export const INK = { muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7" };

const axisProps = {
  tick: { fill: INK.muted, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: INK.axis },
} as const;

function TooltipBox({ title, rows }: { title: string; rows: { label: string; value: number; color: string }[] }) {
  return (
    <div className="rounded-lg border border-default-200 bg-white px-3 py-2 text-small shadow-medium">
      <div className="mb-1 font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
          <span className="text-default-500">{r.label}</span>
          <span className="ml-auto pl-3 tabular-nums font-medium">{money(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function DailyChart({ data }: { data: { day: number; date: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
        <YAxis {...axisProps} axisLine={false} width={48} tickFormatter={moneyShort} />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.05)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={shortDate(payload[0].payload.date)}
                rows={[{ label: "Spent", value: payload[0].payload.amount, color: SERIES.spent }]}
              />
            ) : null
          }
        />
        <Bar isAnimationActive={false} dataKey="amount" fill={SERIES.spent} radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MonthlyChart({ data }: { data: { month: string; income: number; spent: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={INK.grid} />
        <XAxis dataKey="month" {...axisProps} tickFormatter={monthShort} />
        <YAxis {...axisProps} axisLine={false} width={56} tickFormatter={moneyShort} />
        <Tooltip
          cursor={{ fill: "rgba(11,11,11,0.05)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={monthShort(payload[0].payload.month) + " " + payload[0].payload.month.slice(0, 4)}
                rows={[
                  { label: "Income", value: payload[0].payload.income, color: SERIES.income },
                  { label: "Spent", value: payload[0].payload.spent, color: SERIES.spent },
                ]}
              />
            ) : null
          }
        />
        <Bar isAnimationActive={false} dataKey="income" fill={SERIES.income} radius={[4, 4, 0, 0]} maxBarSize={32} />
        <Bar isAnimationActive={false} dataKey="spent" fill={SERIES.spent} radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex gap-4 text-tiny text-default-500">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
