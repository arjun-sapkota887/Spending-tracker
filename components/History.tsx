"use client";

import { Button, Switch, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from "@heroui/react";
import { Trash2 } from "lucide-react";
import { useMemo } from "react";
import { SERIES, SPENDING, colorOf } from "@/lib/categories";
import { money, monthLabel, monthShort, percent } from "@/lib/format";
import type { Transaction } from "@/lib/parse";
import { monthsOf, summarizeMonth } from "@/lib/summary";
import type { Import } from "@/lib/useStore";
import { Legend, MonthlyChart } from "./charts";
import { Panel } from "./Overview";

type Props = {
  transactions: Transaction[];
  imports: Import[];
  onOpenMonth: (month: string) => void;
  onDeleteMonth: (month: string) => void;
  onFlipImport: (id: string) => void;
  onRemoveImport: (id: string) => void;
};

export function History({ transactions, imports, onOpenMonth, onDeleteMonth, onFlipImport, onRemoveImport }: Props) {
  const summaries = useMemo(
    () => monthsOf(transactions).map((m) => summarizeMonth(transactions, m)),
    [transactions],
  );
  // Charts read left to right, oldest first. The tables list the newest month first.
  const chartData = [...summaries].slice(0, 12).reverse();
  const compared = chartData.slice(-6);

  if (!summaries.length) {
    return <p className="py-20 text-center text-default-500">Nothing saved yet. Import a statement to get started.</p>;
  }

  const categoryRows = SPENDING.filter((c) => compared.some((s) => s.byCategory.some((b) => b.category === c)));
  const amountFor = (s: (typeof compared)[number], c: string) => s.byCategory.find((b) => b.category === c)?.amount ?? 0;

  return (
    <div className="grid gap-4">
      <Panel
        title="Income vs spending"
        right={
          <Legend
            items={[
              { label: "Income", color: SERIES.income },
              { label: "Spent", color: SERIES.spent },
            ]}
          />
        }
      >
        <MonthlyChart data={chartData.map((s) => ({ month: s.month, income: s.income, spent: s.spent }))} />
      </Panel>

      <Panel title="Saved months">
        <Table aria-label="Saved months" removeWrapper>
          <TableHeader>
            <TableColumn>MONTH</TableColumn>
            <TableColumn align="end">INCOME</TableColumn>
            <TableColumn align="end">SPENT</TableColumn>
            <TableColumn align="end">SAVED</TableColumn>
            <TableColumn align="end">KEPT</TableColumn>
            <TableColumn align="end"> </TableColumn>
          </TableHeader>
          <TableBody>
            {summaries.map((s) => (
              <TableRow key={s.month}>
                <TableCell>
                  <button className="font-medium text-primary hover:underline" onClick={() => onOpenMonth(s.month)}>
                    {monthLabel(s.month)}
                  </button>
                  <div className="text-tiny text-default-400">{s.count} transactions</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(s.income)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(s.spent)}</TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${s.net < 0 ? "text-danger" : ""}`}>
                  {money(s.net)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-default-500">
                  {s.savingsRate === null ? "—" : percent(s.savingsRate)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label={`Delete ${monthLabel(s.month)}`}
                    onPress={() => {
                      if (confirm(`Delete all ${s.count} transactions from ${monthLabel(s.month)}?`)) onDeleteMonth(s.month);
                    }}
                  >
                    <Trash2 size={16} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {compared.length > 1 && (
        <Panel title="Category comparison" right={`Last ${compared.length} months`}>
          <div className="overflow-x-auto">
            <table className="w-full text-small">
              <thead>
                <tr className="text-tiny text-default-500">
                  <th className="py-2 text-left font-medium">CATEGORY</th>
                  {compared.map((s) => (
                    <th key={s.month} className="py-2 text-right font-medium">
                      {monthShort(s.month).toUpperCase()}
                    </th>
                  ))}
                  <th className="py-2 pl-4 text-right font-medium">CHANGE</th>
                </tr>
              </thead>
              <tbody>
                {categoryRows.map((c) => {
                  const last = amountFor(compared[compared.length - 1], c);
                  const prev = amountFor(compared[compared.length - 2], c);
                  const diff = last - prev;
                  return (
                    <tr key={c} className="border-t border-default-100">
                      <td className="py-2.5">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(c) }} />
                          {c}
                        </span>
                      </td>
                      {compared.map((s) => (
                        <td key={s.month} className="py-2.5 text-right tabular-nums">
                          {amountFor(s, c) ? money(amountFor(s, c)) : <span className="text-default-300">—</span>}
                        </td>
                      ))}
                      <td
                        className={`py-2.5 pl-4 text-right tabular-nums text-tiny font-medium ${
                          Math.abs(diff) < 1 ? "text-default-400" : diff > 0 ? "text-danger" : "text-success-600"
                        }`}
                      >
                        {Math.abs(diff) < 1 ? "—" : `${diff > 0 ? "▲" : "▼"} ${money(Math.abs(diff))}`}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-default-200 font-semibold">
                  <td className="py-2.5">Total spent</td>
                  {compared.map((s) => (
                    <td key={s.month} className="py-2.5 text-right tabular-nums">
                      {money(s.spent)}
                    </td>
                  ))}
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {imports.length > 0 && (
        <Panel title="Imported statements">
          <ul className="divide-y divide-default-100">
            {[...imports].reverse().map((imp) => (
              <li key={imp.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">{imp.account}</div>
                  <div className="text-tiny text-default-400">
                    {imp.fileName} · {new Date(imp.importedAt).toLocaleDateString("en-CA")} · {imp.added} added
                    {imp.duplicates > 0 && `, ${imp.duplicates} duplicates skipped`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch size="sm" isSelected={imp.flipped} onValueChange={() => onFlipImport(imp.id)}>
                    <span className="text-tiny">Signs flipped</span>
                  </Switch>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    onPress={() => {
                      if (confirm(`Remove the ${imp.added} transactions imported from ${imp.fileName}?`)) onRemoveImport(imp.id);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-tiny text-default-400">
            <b>Signs flipped</b> is turned on automatically for statements that list purchases as positive numbers. Toggle it if purchases from a statement show up as income, or income shows up as spending.
          </p>
        </Panel>
      )}
    </div>
  );
}
