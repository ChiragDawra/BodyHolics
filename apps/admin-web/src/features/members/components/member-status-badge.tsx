import { Badge } from '@/components/ui';
import type { MemberStatus } from '../types';

const LABELS: Record<MemberStatus, { text: string; tone: 'positive' | 'warning' | 'neutral' | 'danger' }> = {
  ACTIVE: { text: 'Active', tone: 'positive' },
  EXPIRING: { text: 'Expiring', tone: 'warning' },
  EXPIRED: { text: 'Expired', tone: 'neutral' },
  PENDING_PAYMENT: { text: 'Awaiting payment', tone: 'warning' },
  NONE: { text: 'No membership', tone: 'neutral' },
};

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const { text, tone } = LABELS[status];
  return <Badge tone={tone}>{text}</Badge>;
}
