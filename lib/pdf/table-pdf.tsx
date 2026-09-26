import "server-only";

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

import type { Style } from "@react-pdf/types";

import { T } from "@/lib/pdf/common";

export type PdfColumn = { header: string; flex: number; align: "left" | "right" };

const s = StyleSheet.create({
  page: { paddingTop: 28, paddingBottom: 36, paddingHorizontal: 28, fontFamily: "NotoSans", fontSize: 8.5, color: "#111" },
  title: { fontSize: 15, fontWeight: 700 },
  org: { fontSize: 9, color: "#555", marginBottom: 2 },
  meta: { fontSize: 8.5, color: "#555", marginTop: 1 },
  head: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 3, marginTop: 10, fontWeight: 700 },
  headCont: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#111", paddingBottom: 3, fontWeight: 700 },
  row: { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 0.5, borderColor: "#ddd" },
  cell: { paddingRight: 8 },
  total: { flexDirection: "row", borderTopWidth: 1, borderColor: "#111", paddingTop: 4, marginTop: 2, fontWeight: 700 },
  footer: { position: "absolute", bottom: 16, left: 28, right: 28, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: "#777" },
});

function Row({ cols, cells, style }: { cols: PdfColumn[]; cells: string[]; style: Style }) {
  return (
    <View style={style} wrap={false}>
      {cols.map((c, i) => (
        <View key={i} style={[s.cell, { flex: c.flex }]}>
          <T style={{ textAlign: c.align }}>{cells[i] ?? ""}</T>
        </View>
      ))}
    </View>
  );
}

function TableDocument(props: {
  title: string;
  filterLines: string[];
  columns: PdfColumn[];
  rows: string[][];
  totals?: string[];
  landscape: boolean;
  generatedOn: string;
}) {
  const { title, filterLines, columns, rows, totals, landscape, generatedOn } = props;
  // react-pdf's layout cost grows faster than linearly with rows on one Page, so
  // rows are laid out in fixed-size pages (an oversized row just spills onto an extra page).
  const perPage = landscape ? 24 : 38;
  const firstPage = perPage - 4;
  const chunks: string[][][] = [rows.slice(0, firstPage)];
  for (let i = firstPage; i < rows.length; i += perPage) chunks.push(rows.slice(i, i + perPage));
  return (
    <Document title={`${title} export`} author="Family Welfare Committee">
      {chunks.map((chunk, pi) => (
        <Page key={pi} size="A4" orientation={landscape ? "landscape" : "portrait"} style={s.page}>
          {pi === 0 && (
            <View>
              <Text style={s.org}>Family Welfare Committee</Text>
              <Text style={s.title}>{title}</Text>
              {filterLines.map((l) => (
                <Text key={l} style={s.meta}>{l}</Text>
              ))}
              <Text style={s.meta}>{rows.length} record(s)</Text>
            </View>
          )}

          <View style={pi === 0 ? s.head : s.headCont}>
            {columns.map((c, i) => (
              <View key={i} style={[s.cell, { flex: c.flex }]}>
                <Text style={{ textAlign: c.align }}>{c.header}</Text>
              </View>
            ))}
          </View>
          {chunk.map((cells, i) => (
            <Row key={i} cols={columns} cells={cells} style={s.row} />
          ))}
          {totals && pi === chunks.length - 1 && <Row cols={columns} cells={totals} style={s.total} />}

          <View style={s.footer} fixed>
            <Text>Generated {generatedOn}</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function renderTablePdf(props: Parameters<typeof TableDocument>[0]) {
  const buffer = await renderToBuffer(<TableDocument {...props} />);
  return new Uint8Array(buffer);
}
