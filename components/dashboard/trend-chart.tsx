"use client";

import { useFormatter, useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrendPoint = { month: string; income: number; expense: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();

  const points = data.map((d) => ({
    ...d,
    label: format.dateTime(new Date(`${d.month}-01T00:00:00Z`), {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    }),
  }));

  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tickLine={false} fontSize={12} />
          <YAxis
            width={48}
            tickLine={false}
            axisLine={false}
            fontSize={12}
            tickFormatter={(v: number) => format.number(v, { notation: "compact" })}
          />
          <Tooltip
            formatter={(value) => format.number(Number(value))}
            contentStyle={{ fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name={t("trend.income")} fill="oklch(0.62 0.15 150)" radius={[3, 3, 0, 0]} />
          <Bar dataKey="expense" name={t("trend.expense")} fill="oklch(0.577 0.245 27)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
