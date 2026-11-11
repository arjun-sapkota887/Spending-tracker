import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import { SERIES, colorOf } from "@/lib/categories";
import { money, monthLabel, monthShort, percent, shortDate } from "@/lib/format";
import type { Transaction } from "@/lib/parse";
import type { MonthSummary } from "@/lib/summary";

// Built-in PDF fonts can't draw arrows or the Unicode minus sign, so this file uses only plain characters.

const ink = { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", line: "#e1e0d9", track: "#f0efec" };

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: ink.primary },
  eyebrow: { fontSize: 8, color: ink.muted, textTransform: "uppercase", letterSpacing: 1 },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 2 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 8 },
  section: { marginTop: 18 },
  stats: { flexDirection: "row", gap: 8, marginTop: 16 },
  stat: { flex: 1, borderWidth: 1, borderColor: ink.line, borderRadius: 6, padding: 10 },
  statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 4 },
  small: { fontSize: 7.5, color: ink.secondary, marginTop: 3 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 3.5 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  track: { height: 4, backgroundColor: ink.track, borderRadius: 2, flex: 1, marginHorizontal: 8 },
  right: { textAlign: "right" },
  cols: { flexDirection: "row", gap: 20 },
  col: { flex: 1 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderColor: ink.line, paddingBottom: 4, color: ink.muted, fontSize: 7.5 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: ink.line, paddingVertical: 4 },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: ink.muted },
});

type Props = {
  summary: MonthSummary;
  previous: MonthSummary | null;
  loans: { owedToYou: number; youOwe: number };
  transactions: Transaction[];
};

function change(now: number, before: number | undefined, prevLabel: string) {
  if (before === undefined) return "";
  const d = now - before;
  if (Math.abs(d) < 0.5) return `Same as ${prevLabel}`;
  return `${money(Math.abs(d))} ${d > 0 ? "more" : "less"} than ${prevLabel}`;
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <View style={s.track}>
      <View style={{ width: `${(value / max) * 100}%`, height: 4, backgroundColor: color, borderRadius: 2 }} />
    </View>
  );
}

function Report({ summary, previous, loans, transactions }: Props) {
  const prev = previous ? monthShort(previous.month) : "";
  const prevCat = new Map(previous?.byCategory.map((c) => [c.category, c.amount]));
  const maxCat = summary.byCategory[0]?.amount ?? 1;
  const maxSrc = summary.bySource[0]?.amount ?? 1;
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <Document title={`${monthLabel(summary.month)} overview`}>
      <Page size="LETTER" style={s.page}>
        <Text style={s.eyebrow}>Monthly overview</Text>
        <Text style={s.title}>{monthLabel(summary.month)}</Text>

        <View style={s.stats}>
          <View style={s.stat}>
            <Text style={s.eyebrow}>Spent</Text>
            <Text style={s.statValue}>{money(summary.spent)}</Text>
            <Text style={s.small}>{change(summary.spent, previous?.spent, prev)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.eyebrow}>Income</Text>
            <Text style={s.statValue}>{money(summary.income)}</Text>
            <Text style={s.small}>{change(summary.income, previous?.income, prev)}</Text>
          </View>
          <View style={s.stat}>
            <Text style={s.eyebrow}>{summary.net >= 0 ? "Saved" : "Overspent"}</Text>
            <Text style={s.statValue}>{money(Math.abs(summary.net))}</Text>
            <Text style={s.small}>
              {summary.savingsRate === null ? "No income" : `${percent(Math.max(0, summary.savingsRate))} of income kept`}
            </Text>
          </View>
          <View style={s.stat}>
            <Text style={s.eyebrow}>Owed to you</Text>
            <Text style={s.statValue}>{money(loans.owedToYou)}</Text>
            <Text style={s.small}>You owe {money(loans.youOwe)} (all time)</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>Spending by category</Text>
          {summary.byCategory.map((c) => (
            <View key={c.category} style={s.row}>
              <View style={[s.dot, { backgroundColor: colorOf(c.category) }]} />
              <Text style={{ width: 95 }}>{c.category}</Text>
              <Bar value={c.amount} max={maxCat} color={colorOf(c.category)} />
              <Text style={[s.right, { width: 60, fontFamily: "Helvetica-Bold" }]}>{money(c.amount)}</Text>
              <Text style={[s.right, { width: 30, color: ink.muted }]}>{percent(c.amount / summary.spent)}</Text>
              {previous && (
                <Text style={[s.right, { width: 70, color: ink.secondary, fontSize: 7.5 }]}>
                  {(() => {
                    const d = c.amount - (prevCat.get(c.category) ?? 0);
                    return Math.abs(d) < 1 ? "" : `${d > 0 ? "+" : "-"}${money(Math.abs(d))}`;
                  })()}
                </Text>
              )}
            </View>
          ))}
          {previous && <Text style={[s.small, { marginTop: 6 }]}>Right-hand column: change compared with {prev}.</Text>}
        </View>

        <View style={[s.section, s.cols]}>
          <View style={s.col}>
            <Text style={s.h2}>Income sources</Text>
            {summary.bySource.length ? (
              summary.bySource.map((c) => (
                <View key={c.category} style={s.row}>
                  <Text style={{ width: 90 }}>{c.category}</Text>
                  <Bar value={c.amount} max={maxSrc} color={SERIES.income} />
                  <Text style={[s.right, { width: 58, fontFamily: "Helvetica-Bold" }]}>{money(c.amount)}</Text>
                </View>
              ))
            ) : (
              <Text style={{ color: ink.muted }}>No income recorded.</Text>
            )}
            {(summary.lent !== 0 || summary.borrowed !== 0) && (
              <View style={{ marginTop: 10 }}>
                <Text style={s.h2}>Lent & borrowed</Text>
                <View style={s.row}>
                  <Text style={{ flex: 1 }}>{summary.lent >= 0 ? "Lent out" : "Paid back to you"}</Text>
                  <Text>{money(Math.abs(summary.lent))}</Text>
                </View>
                <View style={s.row}>
                  <Text style={{ flex: 1 }}>{summary.borrowed >= 0 ? "Borrowed" : "You paid back"}</Text>
                  <Text>{money(Math.abs(summary.borrowed))}</Text>
                </View>
              </View>
            )}
          </View>
          <View style={s.col}>
            <Text style={s.h2}>Top merchants</Text>
            {summary.topMerchants.map((m) => (
              <View key={m.merchant} style={s.row}>
                <Text style={{ flex: 1 }}>
                  {m.merchant} <Text style={{ color: ink.muted }}>x{m.count}</Text>
                </Text>
                <Text>{money(m.amount)}</Text>
              </View>
            ))}
            <Text style={[s.h2, { marginTop: 10 }]}>Biggest purchases</Text>
            {summary.largest.map((t) => (
              <View key={t.id} style={s.row}>
                <Text style={{ width: 40, color: ink.muted }}>{shortDate(t.date)}</Text>
                <Text style={{ flex: 1 }}>{t.merchant}</Text>
                <Text>{money(-t.amount)}</Text>
              </View>
            ))}
          </View>
        </View>

        <Footer month={summary.month} />
      </Page>

      <Page size="LETTER" style={s.page}>
        <Text style={s.h2}>All transactions ({sorted.length})</Text>
        <View style={s.th} fixed>
          <Text style={{ width: 45 }}>DATE</Text>
          <Text style={{ flex: 1 }}>DESCRIPTION</Text>
          <Text style={{ width: 95 }}>CATEGORY</Text>
          <Text style={[s.right, { width: 65 }]}>AMOUNT</Text>
        </View>
        {sorted.map((t) => (
          <View key={t.id} style={s.tr} wrap={false}>
            <Text style={{ width: 45, color: ink.secondary }}>{shortDate(t.date)}</Text>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text>{t.merchant}</Text>
              <Text style={{ fontSize: 7, color: ink.muted }}>{t.account}</Text>
            </View>
            <Text style={{ width: 95, color: ink.secondary }}>{t.category}</Text>
            <Text style={[s.right, { width: 65, fontFamily: "Helvetica-Bold" }]}>
              {t.amount > 0 ? "+" : "-"}
              {money(Math.abs(t.amount))}
            </Text>
          </View>
        ))}
        <Footer month={summary.month} />
      </Page>
    </Document>
  );
}

function Footer({ month }: { month: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {monthLabel(month)} overview · generated {new Date().toLocaleDateString("en-CA")}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

export async function downloadReport(props: Props) {
  const blob = await pdf(<Report {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${props.summary.month} overview.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
