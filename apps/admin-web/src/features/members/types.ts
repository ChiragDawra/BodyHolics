export type MemberStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'PENDING_PAYMENT' | 'NONE';

export type MemberListRow = {
  userId: string;
  memberCode: string;
  fullName: string;
  /** Phone if they signed up by OTP, masked email if by Google (D-021). */
  maskedContact: string;
  joinedAt: string;
  membershipStatus: MemberStatus;
  endAt: string | null;
  daysRemaining: number | null;
};

export type MemberDetail = MemberListRow & {
  gymMemberStatus: 'ACTIVE' | 'BLOCKED';
  memberships: {
    id: string;
    planName: string;
    status: string;
    pricePaise: number;
    startAt: string | null;
    endAt: string | null;
  }[];
  payments: {
    id: string;
    amountPaise: number;
    method: string;
    status: string;
    paidAt: string | null;
    createdAt: string;
  }[];
};
