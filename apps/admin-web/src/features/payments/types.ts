export type PaymentRow = {
  id: string;
  memberName: string;
  memberCode: string | null;
  amountPaise: number;
  method: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
  confirmedByName: string | null;
};

export type PaymentTotals = {
  paidPaise: number;
  pendingCount: number;
  failedCount: number;
};
