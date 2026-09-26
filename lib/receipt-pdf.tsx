import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { ReceiptData } from "@/lib/receipts";
import { T, fmtDate, fmtMonth, fmtNum } from "@/lib/pdf/common";

const s = StyleSheet.create({
  page: { padding: 28, fontFamily: "NotoSans", fontSize: 10, color: "#111" },
  header: { borderBottomWidth: 1, borderColor: "#111", paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 15, fontWeight: 700 },
  subtitle: { fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  label: { color: "#555" },
  block: { marginBottom: 12 },
  tableHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 3, marginBottom: 3, fontWeight: 700 },
  tableRow: { flexDirection: "row", paddingVertical: 2 },
  colMonth: { flex: 2 },
  colNote: { flex: 2, color: "#555" },
  colAmount: { flex: 1, textAlign: "right" },
  totalRow: { flexDirection: "row", borderTopWidth: 1, borderColor: "#111", paddingTop: 4, marginTop: 4, fontWeight: 700, fontSize: 11 },
  footer: { marginTop: 18, fontSize: 8, color: "#777" },
});

function ReceiptDocument({ receipt }: { receipt: ReceiptData }) {
  return (
    <Document title={`Receipt ${receipt.receiptNo}`} author="Family Welfare Committee">
      <Page size="A5" style={s.page}>
        <View style={s.header}>
          <Text style={s.title}>Family Welfare Committee</Text>
          <Text style={s.subtitle}>Payment Receipt</Text>
        </View>

        <View style={s.block}>
          <View style={s.row}>
            <Text style={s.label}>Receipt No</Text>
            <Text style={{ fontWeight: 700 }}>{receipt.receiptNo}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Date</Text>
            <Text>{fmtDate(receipt.paidDate)}</Text>
          </View>
        </View>

        <View style={s.block}>
          <View style={s.row}>
            <Text style={s.label}>Member</Text>
            <T style={{ fontWeight: 700 }}>{receipt.member.name}</T>
          </View>
          <View style={s.row}>
            <Text style={s.label}>Serial No</Text>
            <Text>{receipt.member.serialNo}</Text>
          </View>
          <View style={s.row}>
            <Text style={s.label}>CNIC</Text>
            <Text>{receipt.member.cnic}</Text>
          </View>
        </View>

        <View style={s.tableHead}>
          <Text style={s.colMonth}>Month</Text>
          <Text style={s.colNote} />
          <Text style={s.colAmount}>Amount</Text>
        </View>
        {receipt.lines.map((line) => (
          <View key={line.monthCovered.toISOString()} style={s.tableRow} wrap={false}>
            <Text style={s.colMonth}>{fmtMonth(line.monthCovered)}</Text>
            <Text style={s.colNote}>{[line.advance ? "Advance payment" : "", line.wasDoubleFee ? "New-member fee (2x)" : ""].filter(Boolean).join(" · ")}</Text>
            <Text style={s.colAmount}>{fmtNum(line.amount)}</Text>
          </View>
        ))}
        <View style={s.totalRow}>
          <Text style={s.colMonth}>Total</Text>
          <Text style={s.colNote} />
          <Text style={s.colAmount}>{fmtNum(receipt.total)}</Text>
        </View>

        <View style={[s.row, { marginTop: 14 }]}>
          <Text style={s.label}>Recorded by</Text>
          <T>{receipt.recordedBy}</T>
        </View>

        <Text style={s.footer}>Computer-generated receipt. Regenerated from the payment record on request.</Text>
      </Page>
    </Document>
  );
}

export async function renderReceiptPdf(receipt: ReceiptData): Promise<Uint8Array> {
  const buffer = await renderToBuffer(<ReceiptDocument receipt={receipt} />);
  return new Uint8Array(buffer);
}
