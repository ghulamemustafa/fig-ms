import "server-only";

import { prisma } from "@/lib/prisma";

export type ReceiptData = {
  receiptNo: string;
  paidDate: Date;
  member: { name: string; serialNo: string; cnic: string };
  recordedBy: string;
  lines: { monthCovered: Date; amount: number; wasDoubleFee: boolean; advance: boolean }[];
  total: number;
};

/**
 * A receipt is every Payment row sharing a receiptNo — i.e. one payment
 * transaction. Regenerated from the records on demand; nothing is stored.
 */
export async function getReceipt(receiptNo: string): Promise<ReceiptData | null> {
  const payments = await prisma.payment.findMany({
    where: { receiptNo },
    include: {
      member: { select: { name: true, serialNo: true, cnic: true } },
      recordedBy: { select: { name: true } },
    },
    orderBy: { monthCovered: "asc" },
  });
  if (payments.length === 0) return null;

  const first = payments[0];
  const lines = payments.map((p) => ({
    monthCovered: p.monthCovered,
    amount: Number(p.amount),
    wasDoubleFee: p.wasDoubleFee,
    // Paid for a month after the month it was received in.
    advance: p.monthCovered.getTime() > Date.UTC(p.paidDate.getUTCFullYear(), p.paidDate.getUTCMonth(), 1),
  }));

  return {
    receiptNo,
    paidDate: first.paidDate,
    member: first.member,
    recordedBy: first.recordedBy.name,
    lines,
    total: lines.reduce((sum, l) => sum + l.amount, 0),
  };
}

export async function getReceiptNoForPayment(paymentId: string): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { receiptNo: true },
  });
  return payment?.receiptNo ?? null;
}
