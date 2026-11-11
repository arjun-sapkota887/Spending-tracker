"use client";

import {
  Alert,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Spinner,
  Tab,
  Tabs,
} from "@heroui/react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Download, Plus, Upload, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AddEntryModal } from "@/components/AddEntryModal";
import { History } from "@/components/History";
import { Overview } from "@/components/Overview";
import { TransactionsTable } from "@/components/TransactionsTable";
import { ImportButton, Uploader } from "@/components/Uploader";
import { categorize, type Category } from "@/lib/categories";
import { monthLabel } from "@/lib/format";
import { parseStatement, toDayString, type ParseResult, type Transaction } from "@/lib/parse";
import { readPdfStatement } from "@/lib/pdfStatement";
import { loanBalances, monthOf, monthsOf, summarizeMonth, withoutDuplicates } from "@/lib/summary";
import { useStore, type Import, type SaveState } from "@/lib/useStore";

const SAMPLES = [
  "Visa Credit Card - Sep.csv",
  "Chequing Account - Sep.csv",
  "Visa Credit Card - Oct.csv",
  "Chequing Account - Oct.csv",
];

type Incoming = { name: string; read: (account: string, importId: string) => Promise<ParseResult> };

function toIncoming(file: File): Incoming {
  const read = /\.pdf$/i.test(file.name)
    ? (account: string, id: string) => readPdfStatement(file, account, id)
    : /\.csv$/i.test(file.name)
      ? async (account: string, id: string) => parseStatement(await file.text(), account, id)
      : async () => {
          throw new Error("only CSV and PDF statements are supported.");
        };
  return { name: file.name, read };
}

export default function Home() {
  const { data, setData, status } = useStore();
  const [tab, setTab] = useState<"overview" | "history">("overview");
  const [month, setMonth] = useState<string | null>(null);
  const [notices, setNotices] = useState<{ text: string; error?: boolean }[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  const { transactions, imports } = data;
  const months = useMemo(() => monthsOf(transactions), [transactions]);

  // Once data loads, start on the newest month. If the open month gets deleted, fall back to it too.
  useEffect(() => {
    if (months.length && (!month || !months.includes(month))) setMonth(months[0]);
  }, [months, month]);

  const current = month ?? months[0];
  const summary = useMemo(() => current && summarizeMonth(transactions, current), [transactions, current]);
  const previous = useMemo(() => {
    const older = months.find((m) => current && m < current);
    return older ? summarizeMonth(transactions, older) : null;
  }, [transactions, months, current]);
  const loans = useMemo(() => loanBalances(transactions), [transactions]);
  const monthTxns = useMemo(() => transactions.filter((t) => monthOf(t.date) === current), [transactions, current]);

  async function importFiles(files: Incoming[]) {
    const messages: typeof notices = [];
    let next = data;
    const added: Transaction[] = [];

    for (const file of files) {
      const account = file.name.replace(/\.(csv|pdf)$/i, "").replace(/[_]+/g, " ").replace(/\s+-\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*$/i, "").trim();
      const id = crypto.randomUUID();
      try {
        const result = await file.read(account, id);
        if (!result.transactions.length) throw new Error("no transactions found.");
        const fresh = withoutDuplicates(next.transactions, result.transactions);
        const duplicates = result.transactions.length - fresh.length;
        if (fresh.length) {
          const imp: Import = {
            id,
            account,
            fileName: file.name,
            importedAt: new Date().toISOString(),
            flipped: result.flipped,
            added: fresh.length,
            duplicates,
          };
          next = { transactions: [...next.transactions, ...fresh], imports: [...next.imports, imp] };
          added.push(...fresh);
        }
        messages.push({
          text: `${file.name}: ${fresh.length} new transactions${duplicates ? `, ${duplicates} already saved` : ""}.`,
        });
      } catch (e) {
        messages.push({ text: `${file.name}: ${(e as Error).message}`, error: true });
      }
    }

    setData(next);
    setNotices(messages);
    if (added.length) {
      // Jump to the month that got the most new transactions, which is usually the statement's month.
      const counts = new Map<string, number>();
      for (const t of added) counts.set(monthOf(t.date), (counts.get(monthOf(t.date)) ?? 0) + 1);
      setMonth([...counts].sort((a, b) => b[1] - a[1])[0][0]);
      setTab("overview");
    }
  }

  const onFiles = (files: File[]) => importFiles(files.map(toIncoming));

  async function loadSamples() {
    const blobs = await Promise.all(SAMPLES.map(async (name) => (await fetch(`/samples/${encodeURIComponent(name)}`)).blob()));
    await importFiles(SAMPLES.map((name, i) => toIncoming(new File([blobs[i]], name))));
  }

  const updateTxns = (fn: (t: Transaction[]) => Transaction[]) => setData((d) => ({ ...d, transactions: fn(d.transactions) }));

  function flipImport(id: string) {
    setData((d) => ({
      imports: d.imports.map((i) => (i.id === id ? { ...i, flipped: !i.flipped } : i)),
      transactions: d.transactions.map((t) =>
        t.importId === id ? { ...t, amount: -t.amount, category: categorize(t.description, -t.amount) } : t,
      ),
    }));
  }

  async function downloadPdf() {
    if (!summary) return;
    setPdfBusy(true);
    try {
      // The PDF library is big, so it's only loaded the first time someone asks for a report.
      const { downloadReport } = await import("@/components/ReportPdf");
      await downloadReport({ summary, previous, loans, transactions: monthTxns });
    } finally {
      setPdfBusy(false);
    }
  }

  const monthIndex = current ? months.indexOf(current) : -1;
  const hasData = transactions.length > 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-default-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <Wallet size={18} />
            </span>
            <span className="hidden sm:inline">Ledger</span>
          </div>
          {hasData && (
            <Tabs
              size="sm"
              variant="light"
              selectedKey={tab}
              onSelectionChange={(k) => setTab(k as typeof tab)}
              aria-label="Sections"
            >
              <Tab key="overview" title="Overview" />
              <Tab key="history" title="History" />
            </Tabs>
          )}
          <div className="ml-auto flex items-center gap-2">
            <SaveIndicator status={status} />
            {hasData && (
              <>
                <Button size="sm" variant="flat" startContent={<Plus size={16} />} onPress={() => setAddOpen(true)}>
                  <span className="hidden sm:inline">Add entry</span>
                </Button>
                <ImportButton size="sm" color="primary" onFiles={onFiles} startContent={<Upload size={16} />}>
                  <span className="hidden sm:inline">Import</span>
                </ImportButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-5 px-4 py-6">
        {notices.map((n, i) => (
          <Alert
            key={i}
            color={n.error ? "danger" : "success"}
            title={n.text}
            isClosable
            onClose={() => setNotices((prev) => prev.filter((_, j) => j !== i))}
          />
        ))}

        {status === "loading" ? (
          <div className="flex justify-center py-24">
            <Spinner />
          </div>
        ) : !hasData ? (
          <div className="mx-auto w-full max-w-2xl pt-8">
            <h1 className="mb-1 text-center text-3xl font-semibold">Where did my money go?</h1>
            <p className="mb-8 text-center text-default-500">
              Import a month&apos;s statements and get a summary you can compare month to month.
            </p>
            <Uploader onFiles={onFiles} onSample={loadSamples} />
            <div className="mt-4 text-center">
              <Button variant="light" size="sm" startContent={<Plus size={14} />} onPress={() => setAddOpen(true)}>
                Or add an entry by hand
              </Button>
            </div>
          </div>
        ) : tab === "history" ? (
          <History
            transactions={transactions}
            imports={imports}
            onOpenMonth={(m) => {
              setMonth(m);
              setTab("overview");
            }}
            onDeleteMonth={(m) => updateTxns((ts) => ts.filter((t) => monthOf(t.date) !== m))}
            onFlipImport={flipImport}
            onRemoveImport={(id) =>
              setData((d) => ({
                transactions: d.transactions.filter((t) => t.importId !== id),
                imports: d.imports.filter((i) => i.id !== id),
              }))
            }
          />
        ) : (
          summary && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Previous month"
                    isDisabled={monthIndex >= months.length - 1}
                    onPress={() => setMonth(months[monthIndex + 1])}
                  >
                    <ChevronLeft size={20} />
                  </Button>
                  <Dropdown>
                    <DropdownTrigger>
                      <Button variant="light" className="px-2 text-2xl font-semibold" endContent={<ChevronDown size={18} />}>
                        {monthLabel(summary.month)}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Choose month"
                      selectionMode="single"
                      selectedKeys={[summary.month]}
                      onAction={(k) => setMonth(String(k))}
                    >
                      {months.map((m) => (
                        <DropdownItem key={m}>{monthLabel(m)}</DropdownItem>
                      ))}
                    </DropdownMenu>
                  </Dropdown>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    aria-label="Next month"
                    isDisabled={monthIndex <= 0}
                    onPress={() => setMonth(months[monthIndex - 1])}
                  >
                    <ChevronRight size={20} />
                  </Button>
                </div>
                <Button
                  variant="bordered"
                  className="border-1 bg-white"
                  startContent={!pdfBusy && <Download size={16} />}
                  isLoading={pdfBusy}
                  onPress={downloadPdf}
                >
                  Download PDF
                </Button>
              </div>

              <Overview summary={summary} previous={previous} loans={loans} />
              <TransactionsTable
                key={summary.month}
                transactions={monthTxns}
                onRecategorize={(id, category: Category) =>
                  updateTxns((ts) => ts.map((t) => (t.id === id ? { ...t, category } : t)))
                }
                onDelete={(id) => updateTxns((ts) => ts.filter((t) => t.id !== id))}
              />
            </>
          )
        )}
      </main>

      <AddEntryModal
        key={current}
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        defaultDate={current && current !== monthOf(toDayString(new Date())) ? `${current}-01` : toDayString(new Date())}
        onAdd={(t) => {
          updateTxns((ts) => [...ts, t]);
          setMonth(monthOf(t.date));
          setTab("overview");
        }}
      />
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveState }) {
  if (status === "loading") return null;
  if (status === "error") return <span className="text-tiny text-danger">Couldn&apos;t save</span>;
  return (
    <span className="hidden items-center gap-1 text-tiny text-default-400 md:flex">
      {status === "saving" ? <Spinner size="sm" className="scale-75" /> : <Check size={14} />}
      {status === "saving" ? "Saving…" : "Saved"}
    </span>
  );
}
