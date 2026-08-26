export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export type IssueRow = {
  id: string;
  title: string;
  category: string;
  status: IssueStatus;
  memberName: string;
  createdAt: string;
  acknowledgedAt: string | null;
};

export type IssueMessage = {
  id: string;
  authorName: string;
  authorRole: 'MEMBER' | 'STAFF';
  body: string;
  createdAt: string;
};

export type IssueDetail = IssueRow & {
  description: string;
  resolvedAt: string | null;
  messages: IssueMessage[];
};

export type IssueActionResult =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };
