export type BroadcastStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'CANCELLED';

export type BroadcastRow = {
  id: string;
  title: string;
  category: string;
  status: BroadcastStatus;
  audienceLabel: string;
  recipientCount: number;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type BroadcastActionResult =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };
