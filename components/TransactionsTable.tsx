"use client";

import {
  Button,
  Input,
  Pagination,
  Select,
  SelectItem,
  SelectSection,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  type SortDescriptor,
} from "@heroui/react";
import { Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { INCOME, LOANS, SPENDING, TRANSFERS, colorOf, type Category } from "@/lib/categories";
import { money, shortDate } from "@/lib/format";
import type { Transaction } from "@/lib/parse";
import { Panel } from "./Overview";

const PAGE_SIZE = 15;

const GROUPS = [
  { title: "Spending", items: SPENDING },
  { title: "Income", items: INCOME },
  { title: "Loans", items: LOANS },
  { title: "Not counted", items: TRANSFERS },
];

function CategoryOptions() {
  return GROUPS.map((g) => (
    <SelectSection key={g.title} title={g.title} showDivider>
      {g.items.map((c) => (
        <SelectItem key={c} startContent={<span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(c) }} />}>
          {c}
        </SelectItem>
      ))}
    </SelectSection>
  ));
}

type Props = {
  transactions: Transaction[];
  onRecategorize: (id: string, category: Category) => void;
  onDelete: (id: string) => void;
};

export function TransactionsTable({ transactions, onRecategorize, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortDescriptor>({ column: "date", direction: "descending" });

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = transactions.filter(
      (t) =>
        (!filter.size || filter.has(t.category)) &&
        (!q || t.description.toLowerCase().includes(q) || t.merchant.toLowerCase().includes(q)),
    );
    const dir = sort.direction === "ascending" ? 1 : -1;
    return filtered.sort((a, b) =>
      sort.column === "amount" ? (a.amount - b.amount) * dir : a.date.localeCompare(b.date) * dir,
    );
  }, [transactions, search, filter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Panel
      title="Transactions"
      right={
        <div className="flex flex-wrap gap-2">
          <Input
            size="sm"
            className="w-52"
            placeholder="Search"
            startContent={<Search size={14} className="text-default-400" />}
            value={search}
            onValueChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            isClearable
          />
          <Select
            size="sm"
            className="w-52"
            aria-label="Filter by category"
            placeholder="All categories"
            selectionMode="multiple"
            selectedKeys={filter}
            onSelectionChange={(keys) => {
              setFilter(new Set([...keys].map(String)));
              setPage(1);
            }}
          >
            {CategoryOptions()}
          </Select>
        </div>
      }
    >
      <Table
        aria-label="Transactions"
        removeWrapper
        sortDescriptor={sort}
        onSortChange={setSort}
        bottomContent={
          pages > 1 && (
            <div className="flex justify-center">
              <Pagination size="sm" page={page} total={pages} onChange={setPage} showControls />
            </div>
          )
        }
      >
        <TableHeader>
          <TableColumn key="date" allowsSorting>
            DATE
          </TableColumn>
          <TableColumn key="description">DESCRIPTION</TableColumn>
          <TableColumn key="category">CATEGORY</TableColumn>
          <TableColumn key="amount" allowsSorting align="end">
            AMOUNT
          </TableColumn>
          <TableColumn key="actions" align="end">
            {" "}
          </TableColumn>
        </TableHeader>
        <TableBody emptyContent="No matching transactions.">
          {visible.map((t) => (
            <TableRow key={t.id}>
              <TableCell className="whitespace-nowrap text-default-500">{shortDate(t.date)}</TableCell>
              <TableCell>
                <div className="font-medium">{t.merchant}</div>
                <div className="max-w-xs truncate text-tiny text-default-400">
                  {t.account} · {t.description}
                </div>
              </TableCell>
              <TableCell>
                <Select
                  size="sm"
                  variant="flat"
                  aria-label="Category"
                  className="w-48"
                  selectedKeys={[t.category]}
                  disallowEmptySelection
                  startContent={
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(t.category) }} />
                  }
                  onSelectionChange={(keys) => {
                    const c = [...keys][0];
                    if (c) onRecategorize(t.id, c as Category);
                  }}
                >
                  {CategoryOptions()}
                </Select>
              </TableCell>
              <TableCell
                className={`whitespace-nowrap text-right font-medium tabular-nums ${t.amount > 0 ? "text-success-600" : ""}`}
              >
                {t.amount > 0 ? "+" : "−"}
                {money(Math.abs(t.amount))}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  aria-label="Delete transaction"
                  onPress={() => onDelete(t.id)}
                >
                  <Trash2 size={15} className="text-default-400" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  );
}
