export type DashboardKpis = {
  activeMembers: number;
  inactiveMembers: number;
  newThisMonth: number;
  revenueThisMonthPaise: number;
  expiringSoon: number;
  pendingPayments: number;
  openIssues: number;
};

export type AttentionItem = {
  id: string;
  kind: 'EXPIRING' | 'PENDING_PAYMENT' | 'OPEN_ISSUE';
  title: string;
  detail: string;
  href: string;
};
