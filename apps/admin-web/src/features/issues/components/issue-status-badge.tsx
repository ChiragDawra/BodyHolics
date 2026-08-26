import { Badge } from '@/components/ui';
import type { IssueStatus } from '../types';

const LABELS: Record<IssueStatus, { text: string; tone: 'danger' | 'warning' | 'positive' | 'neutral' }> = {
  OPEN: { text: 'Open', tone: 'danger' },
  IN_PROGRESS: { text: 'In progress', tone: 'warning' },
  RESOLVED: { text: 'Resolved', tone: 'positive' },
  CLOSED: { text: 'Closed', tone: 'neutral' },
};

export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const { text, tone } = LABELS[status];
  return <Badge tone={tone}>{text}</Badge>;
}
