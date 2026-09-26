import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { Statement } from "@/lib/exports/statement";
import { T, fmtNum } from "@/lib/pdf/common";

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "NotoSans", fontSize: 10, color: "#111" },
  org: { fontSize: 10, color: "#555" },
  title: { fontSize: 20, fontWeight: 700, marginTop: 2 },
  period: { fontSize: 11, marginTop: 3 },
  rule: { borderBottomWidth: 1.5, borderColor: "#111", marginVertical: 12 },
  cards: { flexDirection: "row", gap: 10, marginBottom: 14 },
  card: { flex: 1, borderWidth: 1, borderColor: "#bbb", borderRadius: 4, padding: 10 },
  cardLabel: { fontSize: 8.5, color: "#555" },
  cardValue: { fontSize: 16, fontWeight: 700, marginTop: 3 },
  h2: { fontSize: 11.5, fontWeight: 700, marginTop: 14, marginBottom: 5 },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: 0.5, borderColor: "#e3e3e3" },
  lineBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderTopWidth: 1, borderColor: "#111", fontWeight: 700, marginTop: 2 },
  muted: { color: "#555" },
  balance: { marginTop: 14, borderWidth: 1, borderColor: "#111", borderRadius: 4, padding: 10 },
  mHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 3, fontWeight: 700 },
  mRow: { flexDirection: "row", paddingVertical: 2, borderBottomWidth: 0.5, borderColor: "#e3e3e3" },
  mc: { flex: 1, textAlign: "right" },
  mcFirst: { flex: 1.2 },
  sign: { flexDirection: "row", justifyContent: "space-between", marginTop: 44 },
  signBox: { width: "40%", borderTopWidth: 1, borderColor: "#111", paddingTop: 4, fontSize: 9, color: "#555" },
  footer: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 8, color: "#777" },
});

const label = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
const monthName = (key: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));

function Line({ name, value, muted }: { name: string; value: number; muted?: boolean }) {
  return (
    <View style={s.line}>
      <T style={muted ? s.muted : {}}>{name}</T>
      <Text>{fmtNum(value)}</Text>
    </View>
  );
}

function StatementDocument({ st, generatedOn }: { st: Statement; generatedOn: string }) {
  return (
    <Document title={`Statement ${st.fromLabel} to ${st.toLabel}`} author="Family Welfare Committee">
      <Page size="A4" style={s.page}>
        <Text style={s.org}>Family Welfare Committee</Text>
        <Text style={s.title}>Statement of Fund Position</Text>
        <Text style={s.period}>
          {st.fromLabel} to {st.toLabel}
        </Text>
        <View style={s.rule} />

        <View style={s.cards}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total collected</Text>
            <Text style={s.cardValue}>{fmtNum(st.income.total)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total paid out</Text>
            <Text style={s.cardValue}>{fmtNum(st.outflow.total)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Net for the period</Text>
            <Text style={s.cardValue}>{fmtNum(st.net)}</Text>
          </View>
        </View>

        <Text style={s.h2}>Income</Text>
        <Line name={`Member fees (${st.income.feeCount} payments)`} value={st.income.feesCollected} />
        <Line name="Other income" value={st.income.otherIncome} />
        <Line name="Donations" value={st.income.donations} />
        <View style={s.lineBold}>
          <Text>Total income</Text>
          <Text>{fmtNum(st.income.total)}</Text>
        </View>

        <Text style={s.h2}>Fund payouts (paid)</Text>
        {st.outflow.payoutsByType.length === 0 && <Text style={s.muted}>None in this period.</Text>}
        {st.outflow.payoutsByType.map((p) => (
          <Line key={p.type} name={`${label(p.type)} (${p.count})`} value={p.amount} />
        ))}
        <View style={s.lineBold}>
          <Text>Total payouts</Text>
          <Text>{fmtNum(st.outflow.payoutsTotal)}</Text>
        </View>

        <Text style={s.h2}>Expenses</Text>
        {st.outflow.expensesByCategory.length === 0 && <Text style={s.muted}>None in this period.</Text>}
        {st.outflow.expensesByCategory.map((e) => (
          <Line key={e.category} name={e.category} value={e.amount} />
        ))}
        <View style={s.lineBold}>
          <Text>Total expenses</Text>
          <Text>{fmtNum(st.outflow.expensesTotal)}</Text>
        </View>

        <View style={s.balance} wrap={false}>
          <Line name="Opening fund balance" value={st.openingBalance} muted />
          <Line name="Net for the period" value={st.net} muted />
          <View style={s.lineBold}>
            <Text style={{ fontSize: 12 }}>Closing fund balance</Text>
            <Text style={{ fontSize: 12 }}>{fmtNum(st.closingBalance)}</Text>
          </View>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Month by month</Text>
          <View style={s.mHead}>
            <Text style={s.mcFirst}>Month</Text>
            <Text style={s.mc}>Income</Text>
            <Text style={s.mc}>Paid out</Text>
            <Text style={s.mc}>Net</Text>
          </View>
          {st.monthly.map((m) => (
            <View key={m.month} style={s.mRow} wrap={false}>
              <Text style={s.mcFirst}>{monthName(m.month)}</Text>
              <Text style={s.mc}>{fmtNum(m.income)}</Text>
              <Text style={s.mc}>{fmtNum(m.outflow)}</Text>
              <Text style={s.mc}>{fmtNum(m.income - m.outflow)}</Text>
            </View>
          ))}
        </View>

        <View style={s.sign} wrap={false}>
          <Text style={s.signBox}>Treasurer</Text>
          <Text style={s.signBox}>President</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Generated {generatedOn} from committee records (cash basis: fees by payment date)</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderStatementPdf(st: Statement) {
  const generatedOn = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(new Date());
  const buffer = await renderToBuffer(<StatementDocument st={st} generatedOn={generatedOn} />);
  return new Uint8Array(buffer);
}
