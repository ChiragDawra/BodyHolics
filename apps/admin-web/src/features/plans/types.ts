export type PlanRow = {
  id: string;
  name: string;
  description: string | null;
  pricePaise: number;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
  /** A plan with sales cannot be repriced in place; the DB trigger refuses it. */
  hasSales: boolean;
};

export type PlanActionResult =
  | { status: 'idle' }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };
