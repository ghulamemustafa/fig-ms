import "server-only";

import path from "node:path";
import { Font, Text } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

// Latin text uses Noto Sans; anything containing Arabic-script (Urdu names typed
// as-is by data entry) switches to Noto Naskh Arabic, which shapes/joins letters.
Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(FONT_DIR, "noto-sans-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "noto-sans-latin-700-normal.woff"), fontWeight: 700 },
  ],
});
Font.register({
  family: "NotoNaskh",
  fonts: [
    { src: path.join(FONT_DIR, "noto-naskh-arabic-arabic-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "noto-naskh-arabic-arabic-700-normal.woff"), fontWeight: 700 },
  ],
});

export const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

/** Text that picks the right font for its content. */
export function T({ children, style }: { children: string; style?: Style | Style[] }) {
  const arabic = ARABIC_SCRIPT.test(children);
  return (
    <Text style={[...(Array.isArray(style) ? style : style ? [style] : []), ...(arabic ? [{ fontFamily: "NotoNaskh" }] : [])]}>
      {children}
    </Text>
  );
}

export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Karachi" }).format(d);
export const fmtMonth = (d: Date) =>
  new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
export const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(n);

